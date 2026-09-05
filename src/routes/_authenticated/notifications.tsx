import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Cake, Heart, TriangleAlert, UserPlus } from "lucide-react";
import { AppShell, EmptyState } from "@/components/AppShell";
import { useNotifications } from "@/lib/useNotifications";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Shepherd" },
      { name: "description", content: "Birthday, anniversary and absentee alerts for your congregation." },
      { property: "og:title", content: "Notifications — Shepherd" },
      { property: "og:description", content: "Alerts for birthdays, anniversaries and missed Sundays." },
    ],
  }),
  component: Notifications,
});

const icons = { birthday: Cake, anniversary: Heart, absent: TriangleAlert, signup: UserPlus };

function Notifications() {
  const { items, loading } = useNotifications();
  const { isFloor } = useAuth();

  return (
    <AppShell title="Notifications" subtitle="Care alerts">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing needs your attention" hint="New alerts appear here automatically." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = icons[n.kind] ?? Bell;
            const inner = (
              <>
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                      n.kind === "absent"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary text-primary"
                    }`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-medium">{n.title}</span>
                    <span className="block text-sm text-muted-foreground">{n.body}</span>
                  </span>
              </>
            );
            const className = "flex items-start gap-3 rounded-2xl border border-border bg-card p-4";
            return (
              <li key={n.id}>
                {isFloor ? (
                  <div className={className}>{inner}</div>
                ) : (
                  <Link to="/members/$memberId" params={{ memberId: n.memberId }} className={className}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
