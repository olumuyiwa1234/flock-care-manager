import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Delete a person completely: their member record, attendance, follow-ups and,
// when they have a login, their account, profile and roles.
// Only approved Pastorate and IT Infrastructure roles may call this.
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid().optional(),
        memberId: z.string().uuid().optional(),
      })
      .refine((v) => v.userId || v.memberId, "Nothing to delete")
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.userId && data.userId === context.userId) {
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

    // Resolve the login attached to this member record, if any.
    let userId = data.userId ?? null;
    if (!userId && data.memberId) {
      const { data: row } = await supabaseAdmin
        .from("members")
        .select("user_id")
        .eq("id", data.memberId)
        .maybeSingle();
      userId = row?.user_id ?? null;
      if (userId === context.userId) {
        throw new Error("You cannot delete your own account.");
      }
    }

    // Collect every member record tied to this person so all their data goes too.
    const memberIds = new Set<string>();
    if (data.memberId) memberIds.add(data.memberId);
    if (userId) {
      const { data: memberRows } = await supabaseAdmin
        .from("members")
        .select("id")
        .or(`user_id.eq.${userId},created_by.eq.${userId}`);
      for (const m of memberRows ?? []) memberIds.add(m.id);
    }

    const ids = [...memberIds];
    if (ids.length > 0) {
      await supabaseAdmin.from("attendance").delete().in("member_id", ids);
      await supabaseAdmin.from("follow_ups").delete().in("member_id", ids);
      await supabaseAdmin.from("members").update({ invited_by: null }).in("invited_by", ids);
      await supabaseAdmin.from("members").delete().in("id", ids);
    }

    if (userId) {
      // Anything else recorded by this user
      await supabaseAdmin.from("attendance").delete().eq("recorded_by", userId);
      await supabaseAdmin.from("follow_ups").delete().eq("created_by", userId);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("pastor_messages").delete().eq("user_id", userId);
      await supabaseAdmin.from("suggestions").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").delete().eq("id", userId);

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
