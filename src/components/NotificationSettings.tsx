import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enablePush, pushMaybeSupported } from "@/lib/push";

/**
 * Lets a person turn on phone notifications for birthdays and wedding
 * anniversaries. The daily alert is sent at 7:00 AM Lagos time.
 */
export function NotificationSettings() {
  const [state, setState] = useState<"unknown" | "on" | "off" | "blocked" | "unsupported">(
    "unknown",
  );
  const [working, setWorking] = useState(false);

  // Read the current browser permission once the page is in the browser.
  useEffect(() => {
    if (!pushMaybeSupported()) {
      setState("unsupported");
      return;
    }
    setState(
      Notification.permission === "granted"
        ? "on"
        : Notification.permission === "denied"
          ? "blocked"
          : "off",
    );
  }, []);

  // Ask for permission and register the device with the notification service.
  async function turnOn() {
    setWorking(true);
    const result = await enablePush();
    setWorking(false);

    if (result.status === "registered") {
      setState("on");
      toast.success("Notifications are on for this device.");
      return;
    }
    if (result.status === "open-in-new-tab") {
      toast.error("Open Shepherd in its own tab or from your home screen, then try again.");
      return;
    }
    if (result.status === "denied") {
      setState("blocked");
      toast.error("Notifications are blocked. Allow them for Shepherd in your browser settings.");
      return;
    }
    if (result.status === "unsupported") {
      setState("unsupported");
      toast.error("This device cannot receive notifications.");
      return;
    }
    toast.error("Could not turn notifications on. Please try again.");
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Bell className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Celebration notifications</p>
          <p className="text-sm text-muted-foreground">
            Get an alert on this phone each morning when someone has a birthday or wedding
            anniversary.
          </p>
        </div>
      </div>

      {/* One line of guidance per possible state of the device. */}
      {state === "on" ? (
        <p className="mt-3 text-sm text-primary">This device will receive celebration alerts.</p>
      ) : state === "blocked" ? (
        <p className="mt-3 text-sm text-destructive">
          Notifications are blocked for Shepherd. Allow them in your browser or phone settings, then
          reopen this page.
        </p>
      ) : state === "unsupported" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          This device does not support notifications. On iPhone, add Shepherd to your home screen
          first.
        </p>
      ) : (
        <Button className="mt-3 w-full" onClick={() => void turnOn()} disabled={working}>
          {working ? "Turning on…" : "Turn on notifications"}
        </Button>
      )}
    </div>
  );
}
