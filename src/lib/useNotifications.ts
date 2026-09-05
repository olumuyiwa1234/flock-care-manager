import { useQuery } from "@tanstack/react-query";
import { useMembers, useAttendance, type MemberRow, type AttendanceRow } from "./queries";
import { lastSundays } from "./shepherd";
import { useAuth } from "./useAuth";
import { celebrationsToday } from "./celebrations.functions";

export type Notification = {
  id: string;
  kind: "birthday" | "anniversary" | "absent";
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

export function missedTwoSundays(members: MemberRow[], attendance: AttendanceRow[]) {
  const [s1, s2] = lastSundays(2);
  const attended = new Set(
    attendance
      .filter(
        (a) =>
          (a.service_date === s1 || a.service_date === s2) &&
          (a.status === "Present" || a.status === "Late"),
      )
      .map((a) => `${a.member_id}:${a.service_date}`),
  );
  return members.filter(
    (m) => !attended.has(`${m.id}:${s1}`) && !attended.has(`${m.id}:${s2}`),
  );
}

export function useNotifications() {
  const { isFloor } = useAuth();
  const membersQuery = useMembers();
  const attendanceQuery = useAttendance(lastSundays(3).at(-1));
  const members = membersQuery.data ?? [];
  const attendance = attendanceQuery.data ?? [];

  const now = new Date();
  const items: Notification[] = [];

  for (const m of members) {
    if (m.birth_month === now.getMonth() + 1 && m.birth_day === now.getDate()) {
      items.push({
        id: `bday-${m.id}`,
        kind: "birthday",
        title: `Birthday today: ${m.full_name}`,
        body: "Send a birthday blessing.",
        memberId: m.id,
      });
    }
  }
  for (const m of anniversariesToday(members)) {
    items.push({
      id: `anniv-${m.id}`,
      kind: "anniversary",
      title: `Wedding anniversary today: ${m.full_name}`,
      body: "Celebrate with the family.",
      memberId: m.id,
    });
  }
  if (!isFloor) {
    for (const m of missedTwoSundays(members, attendance)) {
      items.push({
        id: `absent-${m.id}`,
        kind: "absent",
        title: `${m.full_name} missed two Sundays`,
        body: "Assign a follow-up contact.",
        memberId: m.id,
      });
    }
  }

  return { items, loading: membersQuery.isLoading || attendanceQuery.isLoading, members, attendance };
}
