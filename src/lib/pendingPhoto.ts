import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps the photo chosen on the registration form safe until the new account
 * has a signed-in session (storage uploads require an authenticated user, and
 * with email confirmation the session may only arrive on a later visit).
 */
const KEY = "shepherd:pending-photo";

type StoredPhoto = { name: string; type: string; dataUrl: string };

/** Turns the chosen file into a text form that survives a page reload. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Saves the registration photo locally so it is never lost mid sign-up. */
export async function savePendingPhoto(file: File) {
  try {
    const dataUrl = await fileToDataUrl(file);
    const payload: StoredPhoto = { name: file.name, type: file.type, dataUrl };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable or file too large — upload will simply be skipped */
  }
}

/** Removes the saved photo once it has been uploaded. */
export function clearPendingPhoto() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Reads back the saved photo, if any. */
function readPendingPhoto(): StoredPhoto | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredPhoto) : null;
  } catch {
    return null;
  }
}

/** Converts the stored text form back into a real file for uploading. */
function dataUrlToBlob(dataUrl: string, type: string): Blob {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: type || "image/jpeg" });
}

/**
 * Uploads the saved registration photo for the signed-in user and links it to
 * their member record. Returns true when the photo is stored (or when there
 * was nothing to upload), false when it should be retried later.
 */
export async function flushPendingPhoto(userId: string): Promise<boolean> {
  const stored = readPendingPhoto();
  if (!stored) return true;

  // Upload into the user's own folder, which is what the storage rules allow.
  const ext = (stored.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const blob = dataUrlToBlob(stored.dataUrl, stored.type);
  const { error: uploadError } = await supabase.storage
    .from("member-photos")
    .upload(path, blob, { contentType: stored.type || "image/jpeg", upsert: true });
  if (uploadError) return false;

  // Link the photo to the member record; the record is created by the backend
  // the moment the account is made, so retry briefly in case it is a beat behind.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("members")
      .update({ photo_url: path })
      .eq("user_id", userId)
      .select("id");
    if (!error && data && data.length > 0) {
      clearPendingPhoto();
      return true;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}
