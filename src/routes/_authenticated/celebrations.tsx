import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cake, HeartHandshake } from "lucide-react";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/useAuth";
import { allCelebrations, type CelebrationEntry } from "@/lib/celebrations.functions";

export const Route = createFileRoute("/_authenticated/celebrations")({
  head: () => ({
    meta: [
      { title: "Celebrations — Shepherd" },
      {
        name: "description",
        content: "Birthdays and wedding anniversaries across the church, by day, week or month.",
      },
      { property: "og:title", content: "Celebrations — Shepherd" },
      {
        property: "og:description",
        content: "See who is celebrating a birthday or anniversary today, this week or this month.",
      },
    ],
  }),
  component: Celebrations,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Kind = "all" | "birthday" | "anniversary";
type Period = "day" | "week" | "month";

function inPeriod(entry: CelebrationEntry, period: Period, now: Date) {
  const year = now.getFullYear();
  const date = new Date(year, entry.month - 1, entry.day);
  if (period === "day") {
    return entry.month === now.getMonth() + 1 && entry.day === now.getDate();
  }
  if (period === "month") return entry.month === now.getMonth() + 1;
  const start = new Date(year, now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const next = new Date(year + 1, entry.month - 1, entry.day);
  return (date >= start && date <= end) || (next >= start && next <= end);
}

function Celebrations() {
  const { isFloor } = useAuth();
  const [kind, setKind] = useState<Kind>("all");
  const [period, setPeriod] = useState<Period>("month");

  const query = useQuery({
    queryKey: ["celebrations-all"],
    enabled: !isFloor,
    queryFn: () => allCelebrations(),
  });

  const now = useMemo(() => new Date(), []);
  const list = useMemo(() => {
    const rows = (query.data ?? []).filter(
      (c) => (kind === "all" || c.kind === kind) && inPeriod(c, period, now),
    );
    return rows.sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name));
  }, [query.data, kind, period, now]);

  if (isFloor) {
    return (
      <AppShell title="Celebrations" subtitle="Leaders only" back="/home">
        <p className="text-sm text-muted-foreground">
          Only church leaders can view the celebrations list.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Celebrations" subtitle="Birthdays and wedding anniversaries" back="/home">
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["birthday", "Birthdays"],
              ["anniversary", "Anniversaries"],
            ] as [Kind, string][]
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={kind === value ? "default" : "outline"}
              onClick={() => setKind(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["day", "Today"],
              ["week", "This week"],
              ["month", "This month"],
            ] as [Period, string][]
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={period === value ? "secondary" : "outline"}
              onClick={() => setPeriod(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : "Could not load celebrations."}
        </p>
      ) : list.length === 0 ? (
        <EmptyState title="No celebrations here" hint="Try a different filter." />
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-tile"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
                {c.kind === "birthday" ? (
                  <Cake className="size-5" />
                ) : (
                  <HeartHandshake className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.kind === "birthday" ? "Birthday" : "Wedding anniversary"} ·{" "}
                  {MONTHS[c.month - 1]} {c.day}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
