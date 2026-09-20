import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeofenceResult = {
  churchName: string;
  enabled: boolean;
  allowed: boolean;
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

    // Phone GPS is unreliable indoors: the reported position can be hundreds
    // of metres off even when the phone claims good accuracy. Use the larger
    // of the reported error and a generous baseline as the buffer so members
    // standing inside the church are never rejected. The cap stops a totally
    // failed fix from opening the geofence to the whole city.
    const buffer = Math.min(Math.max(data.accuracy ?? 0, 250), 1500);
    return {
      churchName: s.church_name,
      enabled: true,
      allowed: dist - buffer <= (s.radius_meters ?? 300),
    };
  });
