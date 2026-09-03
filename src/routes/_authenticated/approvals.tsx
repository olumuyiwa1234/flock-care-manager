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
    </AppShell>
  );
}
