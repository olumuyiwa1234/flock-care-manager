import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { AppShell, EmptyState } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/push-log")({
  head: () => ({
    meta: [
      { title: "Celebration Push Log — Shepherd" },
      { name: "description", content: "Review each celebration announcement's time, recipients and delivery status." },
      { property: "og:title", content: "Celebration Push Log — Shepherd" },
      { property: "og:description", content: "Delivery status of celebration push notifications." },
    ],
  }),
  component: PushLog,
});

// Friendly label + colour for each run status.
const STATUS: Record<string, { label: string; cls: string }> = {
  delivered: { label: "Delivered", cls: "bg-success/15 text-success" },
  partial: { label: "Partly failed", cls: "bg-destructive/10 text-destructive" },
  failed: { label: "Failed", cls: "bg-destructive/15 text-destructive" },
  no_recipients: { label: "No devices", cls: "bg-muted text-muted-foreground" },
  running: { label: "Sending…", cls: "bg-secondary text-primary" },
};

function PushLog() {
  const { isFullAccess, loading } = useAuth();
  const [openRun, setOpenRun] = useState<string | null>(null);

  // Load the latest 60 runs (full-access only via RLS).
  const runs = useQuery({
    queryKey: ["push-runs"],
    enabled: isFullAccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("celebration_push_runs")
        .select("*")
        .order("scheduled_for", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  // Load per-device outcomes for the run that is expanded.
  const deliveries = useQuery({
    queryKey: ["push-deliveries", openRun],
    enabled: !!openRun,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("celebration_push_deliveries")
        .select("*")
        .eq("run_id", openRun!)
        .order("status");
      if (error) throw error;
      return data;
    },
  });

  // Block anyone without full access.
  if (!loading && !isFullAccess) {
    return (
      <AppShell title="Push log">
        <EmptyState title="Restricted" hint="Only the Pastor, Parish Coordinator and Admin can view this." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Celebration push log" subtitle="Daily 7 AM announcements">
      {runs.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {runs.data?.length === 0 && (
        <EmptyState title="No announcements sent yet" hint="Runs appear here after the next celebration day." />
      )}
      <div className="space-y-3">
        {runs.data?.map((r) => {
          const s = STATUS[r.status] ?? { label: "Sending…", cls: "bg-secondary text-primary" };
          const open = openRun === r.id;
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-tile">
              {/* Run summary */}
              <button className="w-full text-left" onClick={() => setOpenRun(open ? null : r.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.scheduled_for).toLocaleString("en-GB", { timeZone: "Africa/Lagos" })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                </div>
                <p className="mt-2 text-sm">{r.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {r.recipients_count} recipients · {r.sent_count} sent · {r.failed_count} failed
                </p>
              </button>

              {/* Per-device details, failures first */}
              {open && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {deliveries.isLoading && <p className="text-xs text-muted-foreground">Loading recipients…</p>}
                  {deliveries.data?.length === 0 && <p className="text-xs text-muted-foreground">No devices were targeted.</p>}
                  {deliveries.data?.map((d) => (
                    <div key={d.id} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{d.recipient_name ?? "Unknown user"} <span className="text-xs text-muted-foreground">({d.platform})</span></span>
                        <span className={d.status === "sent" ? "text-success" : "text-destructive"}>
                          {d.status === "sent" ? "Sent" : "Failed"}
                        </span>
                      </div>
                      {d.error && <p className="break-words text-xs text-destructive">{d.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
