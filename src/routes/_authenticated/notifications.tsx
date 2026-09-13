import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Cake, Heart, MailOpen, TriangleAlert, UserPlus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, EmptyState } from "@/components/AppShell";
import { useNotifications } from "@/lib/useNotifications";
import { useAuth } from "@/lib/useAuth";
import { dismissNotification } from "@/lib/notifications.functions";
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

  // Refresh the dismissed list so the badge count updates after deletion.
  function refreshDismissed() {
    queryClient.invalidateQueries({ queryKey: ["notification-dismissals"] });
  }

  // Delete a single notification; it stays removed until new alerts arrive.
  async function deleteOne(id: string) {
    await dismissNotification({ data: { notificationId: id } });
    refreshDismissed();
  }

  // Manual "Clear all" action for the user.
  async function clearAll() {
    if (items.length === 0) return;
    const ids = items.map((n) => n.id);
    await dismissAllNotifications({ data: { notificationIds: ids } });
    refreshDismissed();
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
                <div className="flex items-start gap-2">
                  {/* Main notification body: links to the member when possible. */}
                  {isFloor || !n.memberId ? (
                    <div className="flex min-w-0 flex-1 items-start gap-3 p-4">{inner}</div>
                  ) : (
                    <Link
                      to="/members/$memberId"
                      params={{ memberId: n.memberId }}
                      className={`${className} min-w-0 flex-1 border-0 bg-transparent`}
                    >
                      {inner}
                    </Link>
                  )}
                  {/* Per-item delete button; removing is the only way an alert disappears. */}
                  <button
                    type="button"
                    aria-label="Delete notification"
                    onClick={() => deleteOne(n.id)}
                    className="mt-4 mr-3 grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
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
