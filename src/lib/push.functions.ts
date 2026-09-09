import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Stores (or refreshes) the device registration belonging to the signed-in user
 * so the daily celebration job can send that phone a notification.
 */
export const savePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string; platform?: string }) => {
    // Reject anything that is not a plausible FCM registration token.
    const token = (input?.token ?? "").trim();
    if (token.length < 20) throw new Error("Invalid device token.");
    return { token, platform: input.platform ?? "web" };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // A token is unique per device: re-registering just re-points it at this user.
    const { error } = await supabaseAdmin.from("push_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: data.platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Removes a device registration when the user turns notifications off. */
export const removePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => ({ token: (input?.token ?? "").trim() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
