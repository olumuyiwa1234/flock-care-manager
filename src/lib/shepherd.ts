export type AppRole =
  | "pastorate"
  | "hod"
  | "group_leader"
  | "member"
  | "it_infrastructure"
  | "follow_up";

export const ROLE_LABELS: Record<AppRole, string> = {
  pastorate: "Pastorate",
  hod: "HOD",
  group_leader: "Natural Group Leader",
  member: "Member",
  it_infrastructure: "IT Infrastructure",
  follow_up: "Follow-up",
};

export const PASTORATE_SUB_ROLES = ["Pastor", "Minister"] as const;

export const FELLOWSHIPS = [
  "Men's Fellowship",
  "Good Women Fellowship",
  "Youth Fellowship",
  "Elders Fellowship",
] as const;

export const SERVICE_TYPES = ["Sunday Service", "Midweek Service", "Special Program"] as const;
export const ATTENDANCE_STATUSES = ["Present", "Absent", "Late"] as const;
export const GENDERS = ["Male", "Female"] as const;
export const MARITAL_STATUSES = ["Single", "Married", "Widowed", "Divorced"] as const;
export const AGE_BRACKETS = [
  "0-12",
  "13-17",
  "18-29",
  "30-39",
  "40-49",
  "50 and Above",
] as const;
export const CHILD_BRACKETS = ["0-12", "13-17"] as const;
export const CONTACT_METHODS = ["Phone Call", "SMS", "WhatsApp Message", "Home Visit"] as const;
export const SITUATIONS = ["Sick", "Traveling", "Relocated", "None"] as const;
export const DEPARTMENTS = [
  "Choir",
  "Sanitation",
  "Technical",
  "Media",
  "Usher",
  "Protocol",
  "IT",
  "Greeters",
  "Prayer",
] as const;

/** Departments a HOD can lead — includes Children (child members have no phones). */
export const HOD_DEPARTMENTS = [
  "Choir",
  "Media",
  "Technical",
  "Sanitation",
  "Usher",
  "Greeters",
  "Children",
] as const;

export const PROFILE_DEPARTMENTS = HOD_DEPARTMENTS;

/** Sub-role options per role. Roles without sub-roles return an empty list. */
export const SUB_ROLES: Record<AppRole, readonly string[]> = {
  pastorate: PASTORATE_SUB_ROLES,
  hod: HOD_DEPARTMENTS,
  group_leader: FELLOWSHIPS,
  member: [],
  it_infrastructure: [],
  follow_up: [],
};

/** Mirrors app.fellowship_of() in the database. */
export function fellowshipOf(
  gender: string | null,
  marital: string | null,
  bracket: string | null,
): string | null {
  if (bracket === "50 and Above") return "Elders Fellowship";
  if (bracket === "0-12" || bracket === "13-17") return null;
  if (marital === "Married" && gender === "Male") return "Men's Fellowship";
  if ((marital === "Married" || marital === "Widowed") && gender === "Female")
    return "Good Women Fellowship";
  if (marital !== "Married") return "Youth Fellowship";
  return null;
}


export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function bracketFromBirthYear(year: number | null | undefined): string | null {
  if (!year) return null;
  const age = new Date().getFullYear() - year;
  if (age < 18) return "Under 18";
  if (age < 30) return "18-29";
  if (age < 40) return "30-39";
  if (age < 50) return "40-49";
  return "50 and Above";
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isSunday(d: Date) {
  return d.getDay() === 0;
}

export function lastSundays(count: number, from = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(from);
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1);
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 7);
  }
  return out;
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
