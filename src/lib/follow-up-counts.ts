import type { AttendanceRow, MemberRow } from "@/lib/queries";

/** Only registered children and teenagers belong in the youth follow-up lists. */
export function isYouthMember(member: Pick<MemberRow, "age_bracket">) {
  return member.age_bracket === "0-12" || member.age_bracket === "13-17";
}

/** Count consecutive missed Sundays, stopping at attendance, registration or a completed contact. */
export function missedSundayCount(
  member: Pick<MemberRow, "id" | "created_at">,
  sundays: string[],
  attendance: AttendanceRow[],
  followedUpOn?: string,
) {
  // A present Sunday breaks the streak; other service types never affect it.
  const attended = new Set(attendance
    .filter((row) => row.member_id === member.id && row.service_type === "Sunday Service" && row.status !== "Absent")
    .map((row) => row.service_date));
  let missed = 0;
  for (const sunday of sundays) {
    // Never count services before joining or on/before the last completed follow-up.
    if (sunday < member.created_at.slice(0, 10) || (followedUpOn && sunday <= followedUpOn)) break;
    if (attended.has(sunday)) break;
    missed += 1;
  }
  return missed;
}