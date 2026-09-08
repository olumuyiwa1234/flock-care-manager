import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { AppShell, EmptyState } from "@/components/AppShell";
import { MemberPhoto } from "@/components/MemberPhoto";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMembers } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AGE_BRACKETS,
  DEPARTMENTS,
  GENDERS,
  MARITAL_STATUSES,
} from "@/lib/shepherd";

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

const ALL = "__all__";

function Members() {
  const { isFloor } = useAuth();
  const navigate = useNavigate();
  const { data: members = [], isLoading } = useMembers();
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fDepartment, setFDepartment] = useState(ALL);
  const [fAge, setFAge] = useState(ALL);
  const [fMarital, setFMarital] = useState(ALL);
  const [fGender, setFGender] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);

  const { data: roles = [] } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Workers are users holding any role other than plain "member".
  const workerIds = new Set(
    roles.filter((r) => r.role !== "member").map((r) => r.user_id),
  );

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
  const hasFilters =
    fDepartment !== ALL || fAge !== ALL || fMarital !== ALL || fGender !== ALL || fStatus !== ALL;

  const filtered = members.filter((m) => {
    if (
      term &&
      !(
        m.full_name.toLowerCase().includes(term) ||
        m.member_code.toLowerCase().includes(term) ||
        (m.phone ?? "").toLowerCase().includes(term)
      )
    )
      return false;
    if (fDepartment !== ALL) {
      const depts = (m.department ?? "").split(",").map((d) => d.trim());
      if (!depts.includes(fDepartment)) return false;
    }
    if (fAge !== ALL && m.age_bracket !== fAge) return false;
    if (fMarital !== ALL && m.marital_status !== fMarital) return false;
    if (fGender !== ALL && m.gender !== fGender) return false;
    if (fStatus !== ALL) {
      const isWorker = m.user_id ? workerIds.has(m.user_id) : false;
      if (fStatus === "Worker" && !isWorker) return false;
      if (fStatus === "Member" && isWorker) return false;
    }
    return true;
  });

  function clearFilters() {
    setFDepartment(ALL);
    setFAge(ALL);
    setFMarital(ALL);
    setFGender(ALL);
    setFStatus(ALL);
  }

  return (
    <AppShell
      title="Members"
      subtitle={`${filtered.length} of ${members.length} in the database`}
      action={
        <Button asChild size="icon" variant="secondary" className="rounded-full">
          <Link to="/members/new" aria-label="Add member">
            <Plus className="size-5" />
          </Link>
        </Button>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 pr-11"
          placeholder="Search by name, phone or member ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          aria-label="Toggle filters"
          onClick={() => setShowFilters((v) => !v)}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 ${
            showFilters || hasFilters ? "bg-primary/10 text-primary" : "text-muted-foreground"
          }`}
        >
          <SlidersHorizontal className="size-4" />
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 space-y-2 rounded-2xl border border-border bg-card p-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={fDepartment} onValueChange={setFDepartment}>
              <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fAge} onValueChange={setFAge}>
              <SelectTrigger><SelectValue placeholder="Age bracket" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All ages</SelectItem>
                {AGE_BRACKETS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fMarital} onValueChange={setFMarital}>
              <SelectTrigger><SelectValue placeholder="Marital status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All marital statuses</SelectItem>
                {MARITAL_STATUSES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fGender} onValueChange={setFGender}>
              <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All genders</SelectItem>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Members & workers</SelectItem>
                <SelectItem value="Worker">Workers only</SelectItem>
                <SelectItem value="Member">Non-workers only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
              <X className="size-4" /> Clear filters
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={members.length === 0 ? "No members yet" : "No members match"}
          hint={
            members.length === 0
              ? "Add your first member to start recording attendance."
              : "Try a different search or clear the filters."
          }
          cta={
            members.length === 0 ? (
              <Button asChild>
                <Link to="/members/new">Add member</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
            )
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
