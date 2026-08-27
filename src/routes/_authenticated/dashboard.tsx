import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StatTile } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { useMembers, useAttendance } from "@/lib/queries";
import { anniversariesToday, birthdaysToday, missedTwoSundays } from "@/lib/useNotifications";
import { lastSundays, todayISO } from "@/lib/shepherd";
import { MemberPhoto } from "@/components/MemberPhoto";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Shepherd" },
      { name: "description", content: "Live totals for members, attendance, absentees, visitors, birthdays and anniversaries." },
      { property: "og:title", content: "Dashboard — Shepherd" },
      { property: "og:description", content: "Live church attendance and pastoral care overview." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isFloor } = useAuth();
  const { data: members = [] } = useMembers();
  const { data: attendance = [] } = useAttendance(lastSundays(4).at(-1));

  const today = todayISO();
  const presentToday = new Set(
    attendance.filter((a) => a.service_date === today && a.status !== "Absent").map((a) => a.member_id),
  );
  const firstTimers = members.filter(
    (m) => m.is_first_timer && m.created_at.slice(0, 10) === today,
  );
  const bdays = birthdaysToday(members);
  const annivs = anniversariesToday(members);
  const missed = missedTwoSundays(members, attendance);

  return (
    <AppShell title="Dashboard" subtitle="Today at a glance">
      <div className="grid grid-cols-2 gap-3">
        {!isFloor && (
          <>
            <StatTile label="Total members" value={members.length} to="/members" />
            <StatTile label="Present today" value={presentToday.size} tone="good" to="/attendance" />
            <StatTile
              label="Absent today"
              value={Math.max(members.length - presentToday.size, 0)}
              tone="warn"
            />
            <StatTile label="First-time visitors" value={firstTimers.length} />
          </>
        )}
        <StatTile label="Birthdays this month" value={bdays.length} />
        <StatTile label="Anniversaries today" value={annivs.length} />
      </div>

      {!isFloor && (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Missed two consecutive Sundays</h2>
          {missed.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
              Everyone has been present recently. 🎉
            </p>
          ) : (
            <ul className="space-y-2">
              {missed.slice(0, 20).map((m) => (
                <li key={m.id}>
                  <Link
                    to="/members/$memberId"
                    params={{ memberId: m.id }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <MemberPhoto path={m.photo_url} name={m.full_name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.full_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {m.department ?? "No department"} · {m.member_code}
                      </span>
                    </span>
                    <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                      Absent
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-6 space-y-4">
        <div>
          <h2 className="mb-3 text-base font-semibold">Birthdays this month</h2>
          <PeopleList people={bdays} empty="No birthdays this month." />
        </div>
        <div>
          <h2 className="mb-3 text-base font-semibold">Anniversaries today</h2>
          <PeopleList people={annivs} empty="No anniversaries today." />
        </div>
      </section>
    </AppShell>
  );
}

function PeopleList({
  people,
  empty,
}: {
  people: { id: string; full_name: string; photo_url: string | null; member_code: string }[];
  empty: string;
}) {
  if (people.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  return (
    <ul className="space-y-2">
      {people.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <MemberPhoto path={m.photo_url} name={m.full_name} />
          <span className="min-w-0 flex-1 truncate font-medium">{m.full_name}</span>
          <span className="text-xs text-muted-foreground">{m.member_code}</span>
        </li>
      ))}
    </ul>
  );
}
