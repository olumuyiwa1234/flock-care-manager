import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Lovable's gateway signs the request to Firebase with the connected account,
// so the service-account key never lives in app code.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

/** Today's day and month in Lagos time, regardless of where the server runs. */
function lagosMonthDay() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { month, day };
}

/** Builds the notification wording from today's celebrant names. */
function buildBody(birthdays: string[], anniversaries: string[]) {
  const lines: string[] = [];
  if (birthdays.length) lines.push(`Birthday: ${birthdays.join(", ")}`);
  if (anniversaries.length) lines.push(`Wedding anniversary: ${anniversaries.join(", ")}`);
  return lines.join(" · ");
}

export const Route = createFileRoute("/api/public/hooks/celebration-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Only the scheduled job may trigger this endpoint.
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const lovableApiKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
        if (!lovableApiKey || !connectionKey) {
          return Response.json({ error: "Push is not configured" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { month, day } = lagosMonthDay();

        // Who is celebrating today?
        const { data: members, error: membersError } = await supabaseAdmin
          .from("members")
          .select("full_name, birth_month, birth_day, anniversary_month, anniversary_day");
        if (membersError) {
          return Response.json({ error: membersError.message }, { status: 500 });
        }

        const birthdays: string[] = [];
        const anniversaries: string[] = [];
        for (const m of members ?? []) {
          if (m.birth_month === month && m.birth_day === day) birthdays.push(m.full_name);
          if (m.anniversary_month === month && m.anniversary_day === day) {
            anniversaries.push(m.full_name);
          }
        }

        // Nothing to celebrate: stay quiet.
        if (!birthdays.length && !anniversaries.length) {
          return Response.json({ sent: 0, reason: "no celebrations today" });
        }

        // Every registered device gets the same notification.
        const { data: tokens, error: tokensError } = await supabaseAdmin
          .from("push_tokens")
          .select("token");
        if (tokensError) {
          return Response.json({ error: tokensError.message }, { status: 500 });
        }

        const title =
          birthdays.length && anniversaries.length
            ? "Celebrations today"
            : birthdays.length
              ? birthdays.length > 1
                ? "Birthdays today"
                : "Birthday today"
              : anniversaries.length > 1
                ? "Anniversaries today"
                : "Wedding anniversary today";
        const body = buildBody(birthdays, anniversaries);

        let sent = 0;
        const stale: string[] = [];

        for (const row of tokens ?? []) {
          const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "X-Connection-Api-Key": connectionKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: row.token,
                notification: { title, body },
                data: { path: "/celebrations" },
              },
            }),
          });

          if (res.ok) {
            sent += 1;
            continue;
          }

          // 404/400 means the device uninstalled or reset — drop the token.
          const errorText = await res.text();
          console.error(`FCM send failed [${res.status}]: ${errorText}`);
          if (res.status === 404 || res.status === 400) stale.push(row.token);
        }

        // Clean up devices that can no longer be reached.
        if (stale.length) {
          await supabaseAdmin.from("push_tokens").delete().in("token", stale);
        }

        return Response.json({ sent, removed: stale.length, birthdays, anniversaries });
      },
    },
  },
});
