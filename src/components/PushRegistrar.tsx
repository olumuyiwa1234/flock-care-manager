import { useEffect } from "react";
import { enablePush, pushMaybeSupported } from "@/lib/push";

/**
 * Silently refreshes this device's push registration on every sign-in,
 * but only for people who already allowed notifications. Nobody is prompted.
 */
export function PushRegistrar() {
  useEffect(() => {
    if (!pushMaybeSupported()) return;
    if (Notification.permission !== "granted") return;
    // Best-effort: a failure here must never interrupt the app.
    void enablePush().catch(() => undefined);
  }, []);

  return null;
}
