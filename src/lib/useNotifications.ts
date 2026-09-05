import { useQuery } from "@tanstack/react-query";
import { useMembers, useAttendance, type MemberRow, type AttendanceRow } from "./queries";
import { lastSundays } from "./shepherd";
import { useAuth } from "./useAuth";
import { celebrationsToday } from "./celebrations.functions";
import { recentSignups } from "./signups.functions";

export type Notification = {
  id: string;
  kind: "birthday" | "anniversary" | "absent" | "signup";
  title: string;
  body: string;
  memberId: string;
};

export function birthdaysToday(members: MemberRow[]) {
  const now = new Date();
  return members.filter(
    (m) => m.birth_month === now.getMonth() + 1 && m.birth_day === now.getDate(),
  );
}

export function anniversariesToday(members: MemberRow[]) {
  const now = new Date();
  return members.filter(
    (m) => m.anniversary_month === now.getMonth() + 1 && m.anniversary_day === now.getDate(),
  );
}

/** Members absent from the last two consecutive Sunday Services. */
export function missedTwoSundays(members: MemberRow[], attendance: AttendanceRow[]) {
  const [s1, s2] = lastSundays(2);
  const attended = new Set(
    attendance
      .filter(
        (a) =>
          a.service_type === "Sunday Service" &&
          (a.service_date === s1 || a.service_date === s2) &&
          (a.status === "Present" || a.status === "Late"),
      )
      .map((a) => `${a.member_id}:${a.service_date}`),
  );
  return members.filter(
    (m) => !attended.has(`${m.id}:${s1}`) && !attended.has(`${m.id}:${s2}`),
  );
}

export function useCelebrations() {
  return useQuery({
    queryKey: ["celebrations-today"],
    staleTime: 10 * 60_000,
    queryFn: () => celebrationsToday(),
  });
}

export function useNotifications() {
  const { role, approved, isFullAccess, isFollowUp } = useAuth();
  // Absentee and new-account alerts go only to Pastorate, IT Infrastructure,
  // Follow-up and HODs.
  const isCareTeam = isFullAccess || isFollowUp || (approved && role === "hod");
  const membersQuery = useMembers();
  const attendanceQuery = useAttendance(lastSundays(3).at(-1));
  const celebrationsQuery = useCelebrations();
  const signupsQuery = useQuery({
    queryKey: ["recent-signups"],
    enabled: isCareTeam,
    staleTime: 5 * 60_000,
    queryFn: () => recentSignups(),
  });
  const members = membersQuery.data ?? [];
  const attendance = attendanceQuery.data ?? [];

  const items: Notification[] = [];

  for (const c of celebrationsQuery.data ?? []) {
    items.push({
      id: c.id,
      kind: c.kind,
      title:
        c.kind === "birthday"
          ? `Birthday today: ${c.name}`
          : `Wedding anniversary today: ${c.name}`,
      body: c.kind === "birthday" ? "Send a birthday blessing." : "Celebrate with the family.",
      memberId: c.memberId,
    });
  }

  if (isCareTeam) {
    for (const s of signupsQuery.data ?? []) {
      items.push({
        id: s.id,
        kind: "signup",
        title: `New account: ${s.name}`,
        body: s.department ? `Registered under ${s.department}.` : "Just registered on Shepherd.",
        memberId: s.memberId,
      });
    }
    for (const m of missedTwoSundays(members, attendance)) {
      items.push({
        id: `absent-${m.id}`,
        kind: "absent",
        title: `${m.full_name} missed two Sunday Services`,
        body: "Assign a follow-up contact.",
        memberId: m.id,
      });
    }
  }

  return {
    items,
    loading: membersQuery.isLoading || attendanceQuery.isLoading,
    members,
    attendance,
    isCareTeam,
  };
}
