import { supabase } from "@/integrations/supabase/client";
import type { MemberPayload } from "@/components/MemberForm";

const KEY = "shepherd:pending-member";

export function savePendingMember(payload: MemberPayload) {
  try {
    const { photoFile: _photoFile, ...rest } = payload;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* storage unavailable */
  }
}

export function readPendingMember(): Omit<MemberPayload, "photoFile"> | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
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
