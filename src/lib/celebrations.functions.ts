import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Celebration = {
  id: string;
  memberId: string;
  name: string;
  kind: "birthday" | "anniversary";
};

/**
 * Birthdays and wedding anniversaries falling today, for the whole church.
 * Visible to every signed-in user — returns names only, no contact details.
 */
export const celebrationsToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<Celebration[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const { data, error } = await supabaseAdmin
      .from("members")
      .select("id, full_name, birth_month, birth_day, anniversary_month, anniversary_day");
    if (error) throw new Error(error.message);

    const out: Celebration[] = [];
    for (const m of data ?? []) {
      if (m.birth_month === month && m.birth_day === day) {
        out.push({ id: `bday-${m.id}`, memberId: m.id, name: m.full_name, kind: "birthday" });
      }
      if (m.anniversary_month === month && m.anniversary_day === day) {
        out.push({ id: `anniv-${m.id}`, memberId: m.id, name: m.full_name, kind: "anniversary" });
      }
    }
    return out;
  });

export type CelebrationEntry = {
  id: string;
  memberId: string;
  name: string;
  kind: "birthday" | "anniversary";
  month: number;
  day: number;
};

/**
 * All birthdays and anniversaries in the church, for the celebrations page.
 * Visible to every signed-in user — names and dates only, no contact details.
 */
export const allCelebrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CelebrationEntry[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("members")
      .select("id, full_name, birth_month, birth_day, anniversary_month, anniversary_day");
    if (error) throw new Error(error.message);

    const out: CelebrationEntry[] = [];
    for (const m of data ?? []) {
      if (m.birth_month && m.birth_day) {
        out.push({
          id: `bday-${m.id}`,
          memberId: m.id,
          name: m.full_name,
          kind: "birthday",
          month: m.birth_month,
          day: m.birth_day,
        });
      }
      if (m.anniversary_month && m.anniversary_day) {
        out.push({
          id: `anniv-${m.id}`,
          memberId: m.id,
          name: m.full_name,
          kind: "anniversary",
          month: m.anniversary_month,
          day: m.anniversary_day,
        });
      }
    }
    return out;
  });
