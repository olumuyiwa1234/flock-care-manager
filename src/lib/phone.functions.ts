import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

function normalizePhone(p: string): string {
  return p.replace(/[^\d+]/g, "").replace(/^0+/, "").replace(/^\+/, "");
}

export const checkPhoneExists = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ phone: z.string().min(3) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = normalizePhone(data.phone);
    if (target.length < 5) return { exists: false };

    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, phone")
      .not("phone", "is", null);

    const exists = (rows ?? []).some((r) => {
      const normalized = normalizePhone(r.phone ?? "");
      return normalized.length >= 5 && (normalized === target || normalized.endsWith(target) || target.endsWith(normalized));
    });
    return { exists };
  });
