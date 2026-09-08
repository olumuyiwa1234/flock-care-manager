import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GreetingRow = {
  id: string;
  senderName: string;
  occasion: string;
  message: string;
  createdAt: string;
};

// WhatsApp phone access: Pastor, Parish Coordinator (both pastorate) and Admin.
const WHATSAPP_ROLES = ["pastorate", "it_infrastructure"];

/** Send a birthday / anniversary greeting to a celebrant. Any signed-in user may send. */
export const sendGreeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { memberId: string; occasion: string; message: string }) => {
    const message = (data?.message ?? "").trim();
    if (!data?.memberId) throw new Error("Missing celebrant.");
    if (message.length < 2) throw new Error("Please write a short message.");
    if (message.length > 1000) throw new Error("Message is too long.");
    return { memberId: data.memberId, occasion: data.occasion || "birthday", message };
  })
  .handler(async ({ context, data }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { error } = await context.supabase.from("greetings").insert({
      sender_id: context.userId,
      sender_name: profile?.full_name || "A church member",
      recipient_member_id: data.memberId,
      occasion: data.occasion,
      message: data.message,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Greetings sent to the signed-in user, newest first. */
export const myGreetings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GreetingRow[]> => {
    const { data: mine } = await context.supabase
      .from("members")
      .select("id")
      .eq("user_id", context.userId);
    const ids = (mine ?? []).map((m) => m.id);
    if (ids.length === 0) return [];

    const { data, error } = await context.supabase
      .from("greetings")
      .select("id, sender_name, occasion, message, created_at")
      .in("recipient_member_id", ids)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    return (data ?? []).map((g) => ({
      id: g.id,
      senderName: g.sender_name,
      occasion: g.occasion,
      message: g.message,
      createdAt: g.created_at,
    }));
  });

/**
 * Phone number of a celebrant, for the WhatsApp shortcut.
 * Only approved leaders get a number back; everyone else gets null.
 */
export const celebrantPhone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { memberId: string }) => ({ memberId: data.memberId }))
  .handler(async ({ context, data }): Promise<{ phone: string | null }> => {
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    const ok =
      profile?.approval_status === "approved" &&
      (roleRows ?? []).some((r) => WHATSAPP_ROLES.includes(r.role as string));
    if (!ok) return { phone: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member } = await supabaseAdmin
      .from("members")
      .select("phone")
      .eq("id", data.memberId)
      .maybeSingle();

    return { phone: member?.phone ?? null };
  });
