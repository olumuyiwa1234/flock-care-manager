import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum([
  "pastorate",
  "hod",
  "group_leader",
  "member",
  "it_infrastructure",
  "follow_up",
]);

/** Pastor-only: change another user's role (and sub-role). */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        role: roleSchema,
        subRole: z.string().max(60).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    if (!(roles ?? []).some((r) => r.role === "pastorate")) {
      throw new Error("Only the pastorate can change user roles.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.role === "pastorate" && data.subRole === "Pastor") {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id, sub_role")
        .eq("sub_role", "Pastor");
      if ((existing ?? []).some((p) => p.id !== data.userId)) {
        throw new Error("A Pastor account already exists. Only one Pastor can be registered.");
      }
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insertError) throw new Error(insertError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        sub_role: data.subRole ?? null,
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: context.userId,
      })
      .eq("id", data.userId);
    if (profileError) throw new Error(profileError.message);

    return { ok: true };
  });
