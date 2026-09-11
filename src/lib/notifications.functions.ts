import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fetch every notification ID that the signed-in user has dismissed.
 * The client uses this list to filter out already-seen alerts.
 */
export const getDismissedNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notification_dismissals")
      .select("notification_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.notification_id);
  });

/**
 * Dismiss a single notification for the signed-in user.
 */
export const dismissNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ notificationId: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("notification_dismissals").upsert(
      {
        user_id: userId,
        notification_id: data.notificationId,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,notification_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Dismiss many notifications at once for the signed-in user.
 * Used when the notifications page is opened or the user taps "Clear all".
 */
export const dismissAllNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ notificationIds: z.array(z.string()) }).parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (data.notificationIds.length === 0) return { ok: true };

    const now = new Date().toISOString();
    const rows = data.notificationIds.map((id) => ({
      user_id: userId,
      notification_id: id,
      dismissed_at: now,
    }));

    const { error } = await supabase.from("notification_dismissals").upsert(rows, {
      onConflict: "user_id,notification_id",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
