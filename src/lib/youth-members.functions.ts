import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Youth-leader profile deletion
// ---------------------------------------------------------------------------
// The Children HOD (sub_role "Children") may delete profiles of members aged
// 0-12, and the Teens HOD (sub_role "Teens") may delete profiles of members
// aged 13-17. Deletion is limited to profiles WITHOUT their own login: any
// account with a real sign-in still has to be removed by the pastor through
// the account-deletion approval flow.

// Figure out which age bracket this caller is allowed to manage, if any.
// Returns "0-12" for the Children leader, "13-17" for the Teens leader.
async function callerYouthBracket(context: { supabase: any; userId: string }) {
  // The caller's own profile carries their sub_roles (e.g. "Children", "Teens").
  const { data: profile } = await context.supabase
    .from("profiles")
    .select("sub_role, approval_status")
    .eq("id", context.userId)
    .maybeSingle();

  // Only approved HODs qualify — leadership rights are never derived from
  // user-editable metadata alone.
  const { data: roles } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  const isApprovedHod = (roles ?? []).some((r: { role: string }) => r.role === "hod");

  if (!isApprovedHod || profile?.approval_status !== "approved") return null;

  const subRoles = String(profile.sub_role ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  if (subRoles.includes("Children")) return "0-12";
  if (subRoles.includes("Teens")) return "13-17";
  return null;
}

export const deleteYouthMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        memberId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Only the Children/Teens leader for this member's bracket may proceed.
    const bracket = await callerYouthBracket(context);
    if (!bracket) {
      throw new Error("Only the Children or Teens leader can delete these profiles.");
    }

    // Read the member through the caller's own access (RLS applies), then
    // confirm the profile really belongs to their age bracket.
    const { data: member, error: memberError } = await context.supabase
      .from("members")
      .select("id, full_name, age_bracket, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error("This member could not be found.");
    if (member.age_bracket !== bracket) {
      throw new Error("You can only delete profiles of children or teens in your own group.");
    }
    // Profiles with their own sign-in go through the pastor's approval flow.
    if (member.user_id) {
      throw new Error("This child has their own login — the pastor must handle deleting it.");
    }

    // The row-level delete policy stays limited to full access, so the actual
    // removal runs through the privileged server client after every check.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clear the records attached to this profile first so the member row can go.
    await supabaseAdmin.from("greetings").delete().eq("recipient_member_id", member.id);
    await supabaseAdmin.from("auto_greetings_log").delete().eq("member_id", member.id);
    await supabaseAdmin.from("attendance").delete().eq("member_id", member.id);
    await supabaseAdmin.from("follow_ups").delete().eq("member_id", member.id);

    // Finally remove the member row itself.
    const { error: deleteError } = await supabaseAdmin
      .from("members")
      .delete()
      .eq("id", member.id);
    if (deleteError) throw new Error(deleteError.message);

    return { ok: true };
  });
