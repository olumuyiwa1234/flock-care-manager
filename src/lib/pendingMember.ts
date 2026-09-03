import { supabase } from "@/integrations/supabase/client";

const KEY = "shepherd:pending-member";

export type PendingMember = {
  full_name: string;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  home_address: string | null;
  gender: string | null;
  birth_month: number | null;
  birth_day: number | null;
  age_bracket: string | null;
  anniversary_month: number | null;
  anniversary_day: number | null;
  marital_status: string | null;
  department: string | null;
  membership_year: number | null;
};

export function savePendingMember(payload: PendingMember) {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable */
  }
}

export function readPendingMember(): PendingMember | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingMember) : null;
  } catch {
    return null;
  }
}

export function clearPendingMember() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Creates the signed-in user's own member record from a saved signup draft. */
export async function flushPendingMember(userId: string) {
  const draft = readPendingMember();
  if (!draft) return;
  const { data: existing } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    clearPendingMember();
    return;
  }
  const { error } = await supabase
    .from("members")
    .insert({ ...draft, user_id: userId, created_by: userId });
  if (!error) clearPendingMember();
}
