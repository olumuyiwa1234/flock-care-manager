import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeofenceResult = {
  churchName: string;
  enabled: boolean;
  allowed: boolean;
  /** True when the GPS fix was too imprecise to decide inside/outside. */
  weakSignal?: boolean;
};

// Server-side geofence check: returns only inside/outside, never the church coordinates.
export const checkGeofence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracy: z.number().min(0).max(5000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<GeofenceResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("church_settings")
      .select("church_name, latitude, longitude, radius_meters, geofence_enabled")
      .eq("id", 1)
      .maybeSingle();

    if (!s) return { churchName: "Church", enabled: false, allowed: true };
    if (!s.geofence_enabled || s.latitude == null || s.longitude == null) {
      return { churchName: s.church_name, enabled: false, allowed: true };
    }

    const toRad = (d: number) => (d * Math.PI) / 180;
    const latDelta = toRad(s.latitude - data.lat);
    const lngDelta = toRad(s.longitude - data.lng);
    const a =
      Math.sin(latDelta / 2) ** 2 +
      Math.cos(toRad(data.lat)) * Math.cos(toRad(s.latitude)) * Math.sin(lngDelta / 2) ** 2;
    const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const radius = s.radius_meters ?? 300;
    const MAX_ACCURACY = 150; // readings rougher than this can't be trusted
    const accuracy = data.accuracy;
    const base = { churchName: s.church_name, enabled: true };

    // Unknown or very rough reading: we can't tell, so ask for a better one
    // (never let a vague reading stretch the fence).
    if (accuracy == null || accuracy > MAX_ACCURACY) {
      return { ...base, allowed: false, weakSignal: true };
    }

    // INSIDE: within the set radius plus a small drift allowance (max 50 m).
    if (dist <= radius + Math.min(accuracy, 50)) return { ...base, allowed: true };

    // CLEARLY OUTSIDE: even the nearest edge of the error circle is outside.
    if (dist - accuracy > radius) return { ...base, allowed: false };

    // Borderline: could be either side — keep refining instead of guessing.
    return { ...base, allowed: false, weakSignal: true };
  });
