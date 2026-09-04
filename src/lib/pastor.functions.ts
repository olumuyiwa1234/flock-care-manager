import { createServerFn } from "@tanstack/react-start";

// Public check: is the single Pastor position already taken?
// Returns only a boolean — no personal data is exposed.
export const pastorSeatTaken = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, user_roles!inner(role)")
    .eq("sub_role", "Pastor")
    .eq("user_roles.role", "pastorate")
    .limit(1);
  if (error) throw new Error(error.message);
  return { taken: (data ?? []).length > 0 };
});
