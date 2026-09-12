import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Cake, Heart, MailOpen, TriangleAlert, UserPlus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, EmptyState } from "@/components/AppShell";
import { useNotifications } from "@/lib/useNotifications";
import { useAuth } from "@/lib/useAuth";
import { GreetingDialog } from "@/components/GreetingDialog";

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

const icons = {
  birthday: Cake,
  anniversary: Heart,
  absent: TriangleAlert,
  signup: UserPlus,
  greeting: MailOpen,
};

function Notifications() {
  const { items, loading, dismissAllNotifications } = useNotifications();
  const { isFloor } = useAuth();
  const queryClient = useQueryClient();
  // Track IDs already sent to the server so we only dismiss each once.
  const dismissedRef = useRef<Set<string>>(new Set());

  // When the notifications page opens, mark every visible notification as dismissed.
  // This makes the home badge drop to zero once the user leaves this page.
  useEffect(() => {
    if (loading) return;
    const ids = items.map((n) => n.id).filter((id) => !dismissedRef.current.has(id));
    if (ids.length === 0) return;

    ids.forEach((id) => dismissedRef.current.add(id));
    dismissAllNotifications({ data: { notificationIds: ids } }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["notification-dismissals"] });
    });
  }, [items, loading, queryClient, dismissAllNotifications]);

  // Manual "Clear all" action for the user.
  async function clearAll() {
    if (items.length === 0) return;
    const ids = items.map((n) => n.id);
    ids.forEach((id) => dismissedRef.current.add(id));
    await dismissAllNotifications({ notificationIds: ids });
    queryClient.invalidateQueries({ queryKey: ["notification-dismissals"] });
  }

  const clearButton = (
    <button
      type="button"
      onClick={clearAll}
      disabled={items.length === 0}
      className="inline-flex items-center gap-1 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-foreground/25 disabled:opacity-50"
    >
      <X className="size-4" />
      Clear
    </button>
  );

  return (
    <AppShell title="Notifications" subtitle="Care alerts" action={clearButton}>
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
              <li key={n.id} className="rounded-2xl border border-border bg-card">
                {isFloor || !n.memberId ? (
                  <div className="flex items-start gap-3 p-4">{inner}</div>
                ) : (
                  <Link
                    to="/members/$memberId"
                    params={{ memberId: n.memberId }}
                    className={`${className} border-0 bg-transparent`}
                  >
                    {inner}
                  </Link>
                )}
                {n.celebrant && (
                  <div className="flex justify-end px-4 pb-4">
                    <GreetingDialog
                      memberId={n.celebrant.memberId}
                      name={n.celebrant.name}
                      occasion={n.celebrant.occasion}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
