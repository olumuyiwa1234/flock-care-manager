import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeofenceResult = {
  churchName: string;
  enabled: boolean;
  allowed: boolean;
  /** True when the GPS readings were too imprecise to decide inside/outside. */
  weakSignal?: boolean;
};

// ---------------------------------------------------------------------------
// Tuning constants for the geofence decision.
// ---------------------------------------------------------------------------
// Extra margin added to the church radius to absorb normal phone GPS drift
// (indoor readings commonly wander 30–70 m). Fixed, so a vague reading can
// never stretch the fence further than this.
const DRIFT_ALLOWANCE_M = 75;
// Readings whose reported error is larger than this are ignored for the
// "inside" decision — they are too rough to trust on their own.
const MAX_TRUSTED_ACCURACY_M = 200;
// Readings rougher than this are thrown away completely.
const MAX_USABLE_ACCURACY_M = 1000;

// One GPS reading sent by the phone.
const fixSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(5000).optional(),
});

// Great-circle distance in metres between two coordinates (haversine).
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Server-side geofence check: returns only inside/outside, never the church
// coordinates. Accepts several readings collected over a few seconds so one
// bad reading can't wrongly turn away a member who is inside the church.
export const checkGeofence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        // Legacy single reading (kept so older app versions still work).
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        accuracy: z.number().min(0).max(5000).optional(),
        // New: a batch of recent readings.
        fixes: z.array(fixSchema).max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<GeofenceResult> => {
    // --- Load the church location settings -------------------------------
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
    const churchLat = s.latitude;
    const churchLng = s.longitude;
    const radius = s.radius_meters ?? 300;
    const fence = radius + DRIFT_ALLOWANCE_M;
    const base = { churchName: s.church_name, enabled: true };

    // --- Gather all usable readings --------------------------------------
    const raw = [...(data.fixes ?? [])];
    if (data.lat != null && data.lng != null) {
      raw.push({ lat: data.lat, lng: data.lng, accuracy: data.accuracy });
    }
    const fixes = raw
      .filter((f) => f.accuracy != null && f.accuracy <= MAX_USABLE_ACCURACY_M)
      .map((f) => ({
        accuracy: Math.max(f.accuracy as number, 5),
        dist: distanceMeters(f.lat, f.lng, churchLat, churchLng),
        lat: f.lat,
        lng: f.lng,
      }));
    if (fixes.length === 0) return { ...base, allowed: false, weakSignal: true };

    const trusted = fixes.filter((f) => f.accuracy <= MAX_TRUSTED_ACCURACY_M);

    // --- INSIDE check 1: any trustworthy reading lands inside the fence ----
    if (trusted.some((f) => f.dist <= fence)) return { ...base, allowed: true };

    // --- INSIDE check 2: the accuracy-weighted average of the readings ----
    // Averaging several noisy readings cancels much of the random drift that
    // happens indoors, giving a steadier position than any single reading.
    if (trusted.length >= 2) {
      let wSum = 0;
      let latSum = 0;
      let lngSum = 0;
      for (const f of trusted) {
        const w = 1 / (f.accuracy * f.accuracy);
        wSum += w;
        latSum += f.lat * w;
        lngSum += f.lng * w;
      }
      const avgDist = distanceMeters(latSum / wSum, lngSum / wSum, churchLat, churchLng);
      if (avgDist <= fence) return { ...base, allowed: true };
    }

    // --- CLEARLY OUTSIDE: even the most generous reading is beyond the fence
    // (the nearest edge of its error circle is still outside).
    const nearestPossible = Math.min(...fixes.map((f) => f.dist - f.accuracy));
    if (nearestPossible > fence) return { ...base, allowed: false };

    // --- Undecided: readings too rough or right on the edge — keep refining.
    return { ...base, allowed: false, weakSignal: true };
  });
