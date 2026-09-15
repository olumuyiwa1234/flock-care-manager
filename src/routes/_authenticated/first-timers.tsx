import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MemberForm } from "@/components/MemberForm";
import { MemberPhoto } from "@/components/MemberPhoto";
import { Button } from "@/components/ui/button";
import { useMembers } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import { formatDate } from "@/lib/shepherd";

export const Route = createFileRoute("/_authenticated/first-timers")({
  head: () => ({
    meta: [
      { title: "First Timers — Shepherd" },
      { name: "description", content: "Register and view first-time visitors to the church." },
      { property: "og:title", content: "First Timers — Shepherd" },
      { property: "og:description", content: "Register and view first-time visitors to the church." },
    ],
  }),
  component: FirstTimers,
});

function FirstTimers() {
  // All members visible to the signed-in user
  const { data: members = [] } = useMembers();
  const queryClient = useQueryClient();
  // Toggle between the visitor list and the registration form
  const [adding, setAdding] = useState(false);

  // First-time visitors, most recently registered first
  const firstTimers = members
    .filter((m) => m.is_first_timer)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <AppShell title="First Timers" subtitle="First-time visitors" back="/home">
      {adding ? (
        // Registration form — saved visitors are flagged as first timers automatically
        <MemberForm
          isFirstTimer
          submitLabel="Save first timer"
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["members"] });
            setAdding(false);
          }}
        />
      ) : (
        <>
          <Button className="mb-4 w-full" size="lg" onClick={() => setAdding(true)}>
            <UserPlus className="size-4" /> Register a first timer
          </Button>

          {firstTimers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
              No first-time visitors recorded yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {firstTimers.map((m) => (
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
                        {m.phone ?? "No phone"} · Visited {formatDate(m.created_at)}
                      </span>
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium text-primary">
                      First timer
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
