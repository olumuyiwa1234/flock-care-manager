import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { savePushToken } from "./push.functions";

// Public Firebase web config, supplied by the connected messaging account.
const appId = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as
  | string
  | undefined;
const vapidKey = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as
  | string
  | undefined;

const firebaseConfig = {
  apiKey: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as string,
  projectId: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as string,
  appId: appId ?? "",
  // The sender id is the middle segment of the app id (1:<sender>:web:<hash>).
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" | "failed" };

/** True when the browser could, in principle, receive push notifications. */
export function pushMaybeSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/**
 * Asks the person for notification permission and registers this device.
 * Must be called from a click handler — browsers ignore silent permission requests.
 */
export async function enablePush(): Promise<PushResult> {
  // Bail out early when the messaging account is not fully configured.
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !appId || !vapidKey || !firebaseConfig.messagingSenderId) {
    return { status: "not-configured" };
  }
  if (!pushMaybeSupported() || !(await isSupported())) return { status: "unsupported" };

  // Previews run inside a frame, where the permission prompt never appears.
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  try {
    // The worker reads its Firebase config from these query parameters.
    const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${query}`,
    );
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { status: "denied" };

    // Remember the device so the daily job can reach this phone.
    await savePushToken({ data: { token, platform: "web" } });
    return { status: "registered", token };
  } catch {
    return { status: "failed" };
  }
}
