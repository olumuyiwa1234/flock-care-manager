import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// The name every automatic greeting is signed with.
const CHURCH_FAMILY = "Hope Holl Assembly Family";

/** Today's day and month in Lagos time, regardless of where the server runs. */
function lagosToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date());
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  return { month, day, iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

/** Default greeting text for each occasion, signed by the church family. */
function defaultMessage(occasion: "birthday" | "anniversary") {
  return occasion === "birthday"
    ? `Happy birthday! Wishing you a joyful and blessed year ahead. With love from the ${CHURCH_FAMILY}.`
    : `Happy wedding anniversary! Wishing you and your family many more blessed years together. With love from the ${CHURCH_FAMILY}.`;
}

export const Route = createFileRoute("/api/public/hooks/auto-celebration-greetings")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Only the scheduled job may trigger this endpoint.
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { month, day, iso } = lagosToday();

        // Find everyone celebrating today (birthday or wedding anniversary).
        const { data: members, error: membersError } = await supabaseAdmin
          .from("members")
          .select("id, user_id, birth_month, birth_day, anniversary_month, anniversary_day");
        if (membersError) {
          return Response.json({ error: membersError.message }, { status: 500 });
        }

        // Build the list of greetings to send: one per celebrant per occasion.
        const planned: { memberId: string; userId: string | null; occasion: "birthday" | "anniversary" }[] = [];
        for (const m of members ?? []) {
          if (m.birth_month === month && m.birth_day === day) {
            planned.push({ memberId: m.id, userId: m.user_id, occasion: "birthday" });
          }
          if (m.anniversary_month === month && m.anniversary_day === day) {
            planned.push({ memberId: m.id, userId: m.user_id, occasion: "anniversary" });
          }
        }
        if (planned.length === 0) {
          return Response.json({ sent: 0, reason: "no celebrations today" });
        }

        // Skip any greeting already sent today (the log keeps one row per member/occasion/day).
        const { data: alreadySent } = await supabaseAdmin
          .from("auto_greetings_log")
          .select("member_id, occasion")
          .eq("celebrated_on", iso);
        const sentSet = new Set((alreadySent ?? []).map((r) => `${r.member_id}:${r.occasion}`));

        let sent = 0;
        for (const item of planned) {
          if (sentSet.has(`${item.memberId}:${item.occasion}`)) continue;

          // Record the greeting in the log first so a retry never double-sends.
          const { error: logError } = await supabaseAdmin.from("auto_greetings_log").insert({
            member_id: item.memberId,
            occasion: item.occasion,
            celebrated_on: iso,
          });
          if (logError) continue; // likely a race with another run — skip.

          // Deliver the greeting into the celebrant's notifications.
          const { error: greetingError } = await supabaseAdmin.from("greetings").insert({
            sender_id: null, // automatic greeting — the sender is the church family, not a user
            sender_name: CHURCH_FAMILY,
            recipient_member_id: item.memberId,
            occasion: item.occasion,
            message: defaultMessage(item.occasion),
          });
          if (!greetingError) sent += 1;
        }

        return Response.json({ sent, planned: planned.length });
      },
    },
  },
});
