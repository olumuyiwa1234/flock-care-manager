export type AppRole =
  | "senior_pastor"
  | "attendance_officer"
  | "follow_up_team"
  | "department_leader"
  | "floor_member";

export const ROLE_LABELS: Record<AppRole, string> = {
  senior_pastor: "Senior Pastor",
  attendance_officer: "Attendance Officer",
  follow_up_team: "Follow-up Team",
  department_leader: "Department Leader",
  floor_member: "Floor Member",
};

export const SERVICE_TYPES = ["Sunday Service", "Midweek Service", "Special Program"] as const;
export const ATTENDANCE_STATUSES = ["Present", "Absent", "Late"] as const;
export const GENDERS = ["Male", "Female"] as const;
export const MARITAL_STATUSES = ["Single", "Married", "Widowed", "Divorced"] as const;
export const AGE_BRACKETS = ["Under 18", "18-29", "30-39", "40-49", "50 and Above"] as const;
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

/** Departments a staff account can lead — includes Children (child members have no phones). */
export const PROFILE_DEPARTMENTS = [...DEPARTMENTS, "Children"] as const;

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
