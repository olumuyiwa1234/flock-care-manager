import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, EmptyState } from "@/components/AppShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGE_BRACKETS, MONTHS, formatDate } from "@/lib/shepherd";
import { useAttendance, useMembers, type MemberRow } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Shepherd" },
      { name: "description", content: "Weekly, monthly and yearly attendance reports by department, age bracket and gender." },
      { property: "og:title", content: "Reports — Shepherd" },
      { property: "og:description", content: "Attendance, birthday, anniversary and inactive member reports." },
    ],
  }),
  component: Reports,
});

const REPORTS = [
  "Weekly Attendance",
  "Monthly Attendance",
  "Yearly Attendance",
  "Attendance by Department",
  "Attendance by Age Bracket",
  "Attendance by Gender",
  "Birthday Report",
  "Anniversary Report",
  "Inactive Members",
] as const;

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <EmptyState title="No data for this report yet" />;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground">{r.value}</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-secondary">
            <div
              className="h-2 rounded-full bg-sky-gradient"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function People({ people }: { people: MemberRow[] }) {
  if (people.length === 0) return <EmptyState title="Nobody in this report" />;
  return (
    <ul className="space-y-2">
      {people.map((m) => (
        <li
          key={m.id}
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm"
        >
          <span>
            <span className="block font-medium">{m.full_name}</span>
            <span className="block text-xs text-muted-foreground">
              {m.member_code} · {m.department ?? "No department"}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">{m.phone ?? ""}</span>
        </li>
      ))}
    </ul>
  );
}

function Reports() {
  const { isFloor } = useAuth();
  const [report, setReport] = useState<string>(REPORTS[0]);
  const { data: members = [] } = useMembers();
  const { data: attendance = [] } = useAttendance();

  const present = useMemo(
    () => attendance.filter((a) => a.status === "Present" || a.status === "Late"),
    [attendance],
  );
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const content = useMemo(() => {
    const group = (keyOf: (date: string) => string) => {
      const map = new Map<string, number>();
      for (const a of present) map.set(keyOf(a.service_date), (map.get(keyOf(a.service_date)) ?? 0) + 1);
      return [...map.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, 12)
        .map(([label, value]) => ({ label, value }));
    };
    const byMemberField = (field: (m: MemberRow) => string | null, order?: readonly string[]) => {
      const map = new Map<string, number>();
      for (const a of present) {
        const m = memberById.get(a.member_id);
        if (!m) continue;
        const key = field(m) ?? "Unspecified";
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      const rows = [...map.entries()].map(([label, value]) => ({ label, value }));
      return order
        ? rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
        : rows.sort((a, b) => b.value - a.value);
    };

    switch (report) {
      case "Weekly Attendance":
        return <Bars rows={group((d) => `Week of ${formatDate(weekStart(d))}`)} />;
      case "Monthly Attendance":
        return <Bars rows={group((d) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`)} />;
      case "Yearly Attendance":
        return <Bars rows={group((d) => d.slice(0, 4))} />;
      case "Attendance by Department":
        return <Bars rows={byMemberField((m) => m.department)} />;
      case "Attendance by Age Bracket":
        return <Bars rows={byMemberField((m) => m.age_bracket, AGE_BRACKETS)} />;
      case "Attendance by Gender":
        return <Bars rows={byMemberField((m) => m.gender)} />;
      case "Birthday Report":
        return (
          <People
            people={[...members]
              .filter((m) => m.birth_month)
              .sort((a, b) => (a.birth_month ?? 0) - (b.birth_month ?? 0))}
          />
        );
      case "Anniversary Report":
        return (
          <People
            people={[...members]
              .filter((m) => m.anniversary_month)
              .sort((a, b) => (a.anniversary_month ?? 0) - (b.anniversary_month ?? 0))}
          />
        );
      case "Inactive Members": {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const recent = new Set(
          present.filter((a) => new Date(a.service_date) >= cutoff).map((a) => a.member_id),
        );
        return <People people={members.filter((m) => !recent.has(m.id))} />;
      }
      default:
        return null;
    }
  }, [report, present, members, memberById]);

  if (isFloor) {
    return (
      <AppShell title="Reports">
        <EmptyState title="Not available for floor members" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Reports" subtitle="Attendance insights">
      <Select value={report} onValueChange={setReport}>
        <SelectTrigger className="mb-4">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPORTS.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {content}
    </AppShell>
  );
}

function weekStart(iso: string) {
  const d = new Date(iso);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
