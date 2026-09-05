import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ROLE_LABELS, SUB_ROLES, type AppRole } from "@/lib/shepherd";
import { useAuth } from "@/lib/useAuth";
import { setUserRole } from "@/lib/roles.functions";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({
    meta: [
      { title: "User roles — Shepherd" },
      { name: "description", content: "Pastor tools to assign roles and responsibilities to church accounts." },
      { property: "og:title", content: "User roles — Shepherd" },
      { property: "og:description", content: "Assign or change a member's role in the church app." },
    ],
  }),
  component: Roles,
});

const ROLE_OPTIONS: AppRole[] = [
  "member",
  "pastorate",
  "hod",
  "group_leader",
  "it_infrastructure",
  "follow_up",
];

type PersonRow = {
  id: string;
  full_name: string;
  sub_role: string | null;
  role: AppRole;
};

function Roles() {
  const { isPastor, auth } = useAuth();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { role: AppRole; subRole: string }>>({});

  const peopleQuery = useQuery({
    queryKey: ["all-people"],
    enabled: isPastor,
    queryFn: async (): Promise<PersonRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, sub_role")
        .order("full_name");
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleFor = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
      return (data ?? []).map((p) => ({ ...p, role: roleFor.get(p.id) ?? "member" }));
    },
  });

  async function save(person: PersonRow) {
    const next = draft[person.id] ?? { role: person.role, subRole: person.sub_role ?? "" };
    setSavingId(person.id);
    try {
      await setUserRole({
        data: {
          userId: person.id,
          role: next.role,
          subRole: next.subRole || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["all-people"] });
      toast.success("Role updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the role");
    } finally {
      setSavingId(null);
    }
  }

  if (!isPastor) {
    return (
      <AppShell title="User roles" subtitle="Pastor only" back="/home">
        <p className="text-sm text-muted-foreground">Only the pastor can change user roles.</p>
      </AppShell>
    );
  }

  const people = (peopleQuery.data ?? []).filter((p) => p.id !== auth?.userId);

  return (
    <AppShell title="User roles" subtitle="Assign roles and responsibilities" back="/home">
      {peopleQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState title="No other accounts yet" />
      ) : (
        <ul className="space-y-3">
          {people.map((p) => {
            const current = draft[p.id] ?? { role: p.role, subRole: p.sub_role ?? "" };
            const subs = SUB_ROLES[current.role] as readonly string[];
            const changed =
              current.role !== p.role || (current.subRole || null) !== (p.sub_role || null);
            return (
              <li key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-tile">
                <p className="text-base font-semibold">{p.full_name || "Unnamed"}</p>
                <p className="text-sm text-muted-foreground">
                  Currently {ROLE_LABELS[p.role]}
                  {p.sub_role ? ` · ${p.sub_role}` : ""}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Select
                    value={current.role}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, [p.id]: { role: v as AppRole, subRole: "" } }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {subs.length > 0 && (
                    <Select
                      value={current.subRole}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, [p.id]: { ...current, subRole: v } }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={current.role === "hod" ? "Department" : "Sub-role"} />
                      </SelectTrigger>
                      <SelectContent>
                        {subs.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={!changed || savingId === p.id}
                  onClick={() => void save(p)}
                >
                  {savingId === p.id ? "Saving…" : "Save role"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
