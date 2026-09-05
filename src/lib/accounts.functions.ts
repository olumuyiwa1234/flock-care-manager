import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Delete a user's account (auth user + profile + roles via cascade).
// Only approved Pastorate and IT Infrastructure roles may call this.
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }

    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw new Error(rolesError.message);

    const isFullAccess = (roles ?? []).some(
      (r) => r.role === "pastorate" || r.role === "it_infrastructure",
    );
    if (!isFullAccess) {
      throw new Error("Only Pastorate and IT Infrastructure can delete accounts.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Collect every member record tied to this user so all their data goes too.
    const { data: memberRows } = await supabaseAdmin
      .from("members")
      .select("id")
      .or(`user_id.eq.${data.userId},created_by.eq.${data.userId}`);
    const memberIds = (memberRows ?? []).map((m) => m.id);

    if (memberIds.length > 0) {
      await supabaseAdmin.from("attendance").delete().in("member_id", memberIds);
      await supabaseAdmin.from("follow_ups").delete().in("member_id", memberIds);
      await supabaseAdmin.from("members").update({ invited_by: null }).in("invited_by", memberIds);
      await supabaseAdmin.from("members").delete().in("id", memberIds);
    }

    // Anything else recorded by this user
    await supabaseAdmin.from("attendance").delete().eq("recorded_by", data.userId);
    await supabaseAdmin.from("follow_ups").delete().eq("created_by", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
