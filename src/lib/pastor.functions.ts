import { createServerFn } from "@tanstack/react-start";

// Public check: is the single Pastor position already taken?
// Returns only a boolean — no personal data is exposed.
export const pastorSeatTaken = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "pastorate");
  if (roleError) throw new Error(roleError.message);

  const ids = (roleRows ?? []).map((r) => r.user_id);
  if (ids.length === 0) return { taken: false };

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, sub_role")
    .in("id", ids)
    .not("sub_role", "is", null);
  if (error) throw new Error(error.message);

  const taken = (data ?? []).some((p) =>
    (p.sub_role ?? "").split(",").map((s) => s.trim()).includes("Pastor"),
  );
  return { taken };
});
