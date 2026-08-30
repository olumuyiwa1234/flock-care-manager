import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { AppShell, EmptyState } from "@/components/AppShell";
import { MemberPhoto } from "@/components/MemberPhoto";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMembers } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/members/")({
  head: () => ({
    meta: [
      { title: "Members — Shepherd" },
      { name: "description", content: "Search the church member database by name, phone number or member ID." },
      { property: "og:title", content: "Members — Shepherd" },
      { property: "og:description", content: "Search and manage your church member database." },
    ],
  }),
  component: Members,
});

function Members() {
  const { isFloor } = useAuth();
  const navigate = useNavigate();
  const { data: members = [], isLoading } = useMembers();
  const [q, setQ] = useState("");

  if (isFloor) {
    return (
      <AppShell title="Members">
        <EmptyState
          title="Not available for floor members"
          hint="Ask a church leader if you need member records."
          cta={<Button onClick={() => navigate({ to: "/home" })}>Back home</Button>}
        />
      </AppShell>
    );
  }

  const term = q.trim().toLowerCase();
  const filtered = term
    ? members.filter(
        (m) =>
          m.full_name.toLowerCase().includes(term) ||
          m.member_code.toLowerCase().includes(term) ||
          (m.phone ?? "").toLowerCase().includes(term),
      )
    : members;

  return (
    <AppShell
      title="Members"
      subtitle={`${members.length} in the database`}
      action={
        <Button asChild size="icon" variant="secondary" className="rounded-full">
          <Link to="/members/new" aria-label="Add member">
            <Plus className="size-5" />
          </Link>
        </Button>
      }
    >
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone or member ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No members yet"
          hint="Add your first member to start recording attendance."
          cta={
            <Button asChild>
              <Link to="/members/new">Add member</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((m) => (
            <li key={m.id}>
              <Link
                to="/members/$memberId"
                params={{ memberId: m.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition active:scale-[0.99]"
              >
                <MemberPhoto path={m.photo_url} name={m.full_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.full_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.member_code} · {m.department ?? "No department"}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </span>
                </span>
                {m.is_first_timer && (
                  <span className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-semibold uppercase text-accent">
                    Visitor
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
