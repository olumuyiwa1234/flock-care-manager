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

/**
 * Creates — or completes — the signed-in user's own member record from the
 * details they typed at registration.
 *
 * The backend already creates a member row the moment an account is created,
 * so if a row exists we must FILL IN any detail that is still empty rather
 * than skipping (skipping was silently losing gender, birthday, age bracket,
 * marital status, address and membership year).
 */
export async function flushPendingMember(userId: string) {
  const draft = readPendingMember();
  if (!draft) return;

  // Look for the member record already linked to this account.
  const { data: existing } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // No record yet: create one holding every detail from the form.
  if (!existing) {
    const { error } = await supabase
      .from("members")
      .insert({ ...draft, user_id: userId, created_by: userId });
    if (!error) clearPendingMember();
    return;
  }

  // Record exists: copy across only the details that are still missing,
  // so nothing the person already corrected in the app gets overwritten.
  const row = existing as Record<string, unknown>;
  const patch: Partial<PendingMember> = {};
  for (const key of Object.keys(draft) as (keyof PendingMember)[]) {
    const value = draft[key];
    if (value === null || value === "") continue;
    const current = row[key as string];
    if (current === null || current === undefined || current === "") {
      // Safe: keys and values both come from the saved registration draft.
      (patch as Record<string, unknown>)[key as string] = value;
    }
  }

  if (Object.keys(patch).length === 0) {
    clearPendingMember();
    return;
  }

  const { error } = await supabase.from("members").update(patch).eq("user_id", userId);
  if (!error) clearPendingMember();
}
