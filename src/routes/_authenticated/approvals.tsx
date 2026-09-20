import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";
import { ROLE_LABELS, type AppRole } from "@/lib/shepherd";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Access approvals — Shepherd" },
      {
        name: "description",
        content: "Review and approve leadership access requests for your church on Shepherd.",
      },
      { property: "og:title", content: "Access approvals — Shepherd" },
      { property: "og:description", content: "Approve or decline pending leader accounts." },
    ],
  }),
  component: Approvals,
});

type PendingRow = {
  id: string;
  full_name: string;
  phone: string | null;
  department: string | null;
  sub_role: string | null;
  role: AppRole;
};

export function usePendingApprovals(enabled: boolean) {
  return useQuery({
    queryKey: ["approvals", "pending"],
    enabled,
    queryFn: async (): Promise<PendingRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, department, sub_role")
        .eq("approval_status", "pending");
      if (error) throw error;
      const ids = (data ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      const roleFor = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
      return (data ?? []).map((p) => ({ ...p, role: roleFor.get(p.id) ?? "member" }));
    },
  });
}

function Approvals() {
  const { isPastor, auth } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = usePendingApprovals(isPastor);

  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase
      .from("profiles")
      .update({
        approval_status: status,
        approved_at: status === "approved" ? new Date().toISOString() : null,
        approved_by: auth?.userId ?? null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "approved" ? "Access granted" : "Request declined");
    await queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
  }

  if (!isPastor) {
    return (
      <AppShell title="Access approvals" subtitle="Pastor only" back="/home">
        <p className="text-sm text-muted-foreground">
          Only the pastorate can review access requests.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Access approvals" subtitle="Pending leadership requests" back="/home">
      {isLoading && <p className="text-sm text-muted-foreground">Loading requests…</p>}
      {!isLoading && (data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No pending requests.</p>
      )}
      <div className="space-y-3">
        {(data ?? []).map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4 shadow-tile">
            <p className="text-base font-semibold">{p.full_name || "Unnamed"}</p>
            <p className="text-sm text-muted-foreground">
              {ROLE_LABELS[p.role]}
              {p.sub_role ? ` · ${p.sub_role}` : ""}
              {p.phone ? ` · ${p.phone}` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => decide(p.id, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => decide(p.id, "rejected")}>
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Account deletions raised by Admin staff — nothing is removed until approved here. */}
      <DeletionRequests />
    </AppShell>
  );
}

// Pending account-deletion requests waiting on the pastor's decision.
function DeletionRequests() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["deletion-requests", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_requests")
        .select("id, member_name, reason, requested_by_name, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Approving performs the full wipe on the server; declining just closes it.
  async function decideDeletion(id: string, decision: "approved" | "rejected") {
    setBusyId(id);
    try {
      await decideAccountDeletion({ data: { requestId: id, decision } });
      toast.success(decision === "approved" ? "Account deleted" : "Request declined");
      await queryClient.invalidateQueries({ queryKey: ["deletion-requests", "pending"] });
      await queryClient.invalidateQueries({ queryKey: ["members"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete this request");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-base font-semibold">Account deletion requests</h2>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && (data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No accounts awaiting deletion approval.</p>
      )}
      <div className="space-y-3">
        {(data ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-tile">
            <p className="text-base font-semibold">{r.member_name || "Unnamed"}</p>
            <p className="text-sm text-muted-foreground">
              Requested by {r.requested_by_name || "a leader"} · {formatDate(r.created_at.slice(0, 10))}
            </p>
            {r.reason && <p className="mt-1 text-sm text-muted-foreground">{r.reason}</p>}
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={busyId === r.id}
                onClick={() => decideDeletion(r.id, "approved")}
              >
                {busyId === r.id ? "Working…" : "Approve deletion"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyId === r.id}
                onClick={() => decideDeletion(r.id, "rejected")}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

