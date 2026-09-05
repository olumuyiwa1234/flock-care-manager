import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NewSignup = {
  id: string;
  memberId: string;
  name: string;
  department: string | null;
  createdAt: string;
};

/**
 * Accounts registered in the last 7 days.
 * Only Pastorate, IT Infrastructure, Follow-up and HODs get this list.
 */
export const recentSignups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NewSignup[]> => {
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw new Error(rolesError.message);

    const allowed = ["pastorate", "it_infrastructure", "follow_up", "hod"];
    if (!(roles ?? []).some((r) => allowed.includes(r.role))) return [];

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("members")
      .select("id, full_name, department, created_at, user_id")
      .not("user_id", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    return (data ?? []).map((m) => ({
      id: `signup-${m.id}`,
      memberId: m.id,
      name: m.full_name,
      department: m.department,
      createdAt: m.created_at,
    }));
  });
