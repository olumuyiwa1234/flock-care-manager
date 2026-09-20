import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Shared checks
// ---------------------------------------------------------------------------

// Read the roles of the signed-in caller once, so each function can decide
// whether they are allowed to request or approve a deletion.
async function callerRoles(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return {
    roles,
    // Pastorate and Admin may raise a deletion request.
    isFullAccess: roles.includes("pastorate") || roles.includes("it_infrastructure"),
    // Only the pastorate can actually approve a deletion.
    isPastor: roles.includes("pastorate"),
  };
}

// Wipe a person and everything attached to them. Called only after approval.
async function wipeAccount(memberId: string | null, userId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Resolve the login attached to this member record, if any.
  let uid = userId;
  if (!uid && memberId) {
    const { data: row } = await supabaseAdmin
      .from("members")
      .select("user_id")
      .eq("id", memberId)
      .maybeSingle();
    uid = row?.user_id ?? null;
  }

  // Collect every member record tied to this person so all their data goes too.
  const memberIds = new Set<string>();
  if (memberId) memberIds.add(memberId);
  if (uid) {
    const { data: memberRows } = await supabaseAdmin
      .from("members")
      .select("id")
      .or(`user_id.eq.${uid},created_by.eq.${uid}`);
    for (const m of memberRows ?? []) memberIds.add(m.id);
  }

  const ids = [...memberIds];
  if (ids.length > 0) {
    await supabaseAdmin.from("attendance").delete().in("member_id", ids);
    await supabaseAdmin.from("follow_ups").delete().in("member_id", ids);
    await supabaseAdmin.from("members").update({ invited_by: null }).in("invited_by", ids);
    await supabaseAdmin.from("members").delete().in("id", ids);
  }

  if (uid) {
    // Anything else recorded by this user
    await supabaseAdmin.from("attendance").delete().eq("recorded_by", uid);
    await supabaseAdmin.from("follow_ups").delete().eq("created_by", uid);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("pastor_messages").delete().eq("user_id", uid);
    await supabaseAdmin.from("suggestions").delete().eq("user_id", uid);
    await supabaseAdmin.from("profiles").delete().eq("id", uid);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Step 1 — ask the pastor to approve a deletion
// ---------------------------------------------------------------------------

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid().optional(),
        memberId: z.string().uuid().optional(),
        memberName: z.string().default(""),
        reason: z.string().max(500).optional(),
      })
      .refine((v) => v.userId || v.memberId, "Nothing to delete")
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Nobody may request the removal of their own account.
    if (data.userId && data.userId === context.userId) {
      throw new Error("You cannot delete your own account.");
    }

    const { isFullAccess } = await callerRoles(context);
    if (!isFullAccess) {
      throw new Error("Only Pastorate and Admin can delete accounts.");
    }

    // Don't stack duplicate requests for the same person.
    const { data: existing } = await context.supabase
      .from("deletion_requests")
      .select("id")
      .eq("status", "pending")
      .or(
        [
          data.memberId ? `member_id.eq.${data.memberId}` : null,
          data.userId ? `target_user_id.eq.${data.userId}` : null,
        ]
          .filter(Boolean)
          .join(","),
      )
      .maybeSingle();
    if (existing) {
      return { ok: true, alreadyPending: true };
    }

    // Record who asked, so the pastor sees the name on the approval card.
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { error } = await context.supabase.from("deletion_requests").insert({
      member_id: data.memberId ?? null,
      target_user_id: data.userId ?? null,
      member_name: data.memberName ?? "",
      reason: data.reason ?? null,
      requested_by: context.userId,
      requested_by_name: profile?.full_name ?? "",
    });
    if (error) throw new Error(error.message);

    return { ok: true, alreadyPending: false };
  });

// ---------------------------------------------------------------------------
// Step 2 — the pastor approves or declines, and approval performs the wipe
// ---------------------------------------------------------------------------

export const decideAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        requestId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { isPastor } = await callerRoles(context);
    if (!isPastor) throw new Error("Only the pastor can approve account deletions.");

    // Load the request being decided.
    const { data: req, error: reqError } = await context.supabase
      .from("deletion_requests")
      .select("id, member_id, target_user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (reqError) throw new Error(reqError.message);
    if (!req) throw new Error("This request no longer exists.");
    if (req.status !== "pending") throw new Error("This request has already been decided.");
    if (req.target_user_id && req.target_user_id === context.userId) {
      throw new Error("You cannot delete your own account.");
    }

    // Mark the decision first, then wipe when approved.
    const { error: updateError } = await context.supabase
      .from("deletion_requests")
      .update({
        status: data.decision,
        decided_by: context.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    if (updateError) throw new Error(updateError.message);

    if (data.decision === "approved") {
      await wipeAccount(req.member_id ?? null, req.target_user_id ?? null);
    }

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Direct deletion — reserved for the pastorate, who are the approvers anyway
// ---------------------------------------------------------------------------

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

    const { isPastor } = await callerRoles(context);
    if (!isPastor) {
      throw new Error("The pastor has to approve before an account is deleted.");
    }

    await wipeAccount(data.memberId ?? null, data.userId ?? null);
    return { ok: true };
  });
