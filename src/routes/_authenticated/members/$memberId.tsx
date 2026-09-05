import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MemberPhoto } from "@/components/MemberPhoto";
import { MemberForm } from "@/components/MemberForm";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MONTHS, formatDate } from "@/lib/shepherd";
import type { MemberRow, AttendanceRow } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import { deleteUserAccount } from "@/lib/accounts.functions";

export const Route = createFileRoute("/_authenticated/members/$memberId")({
  head: () => ({
    meta: [
      { title: "Member profile — Shepherd" },
      { name: "description", content: "Member profile with contact details and full attendance history." },
      { property: "og:title", content: "Member profile — Shepherd" },
      { property: "og:description", content: "Profile details and attendance history for a church member." },
    ],
  }),
  component: MemberDetail,
  errorComponent: ({ error }) => (
    <AppShell title="Member" back="/members">
      <p className="text-sm text-destructive">{error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Member" back="/members">
      <p className="text-sm text-muted-foreground">This member could not be found.</p>
    </AppShell>
  ),
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

function MemberDetail() {
  const { memberId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { isFullAccess, auth } = useAuth();

  const memberQuery = useQuery({
    queryKey: ["member", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").eq("id", memberId).maybeSingle();
      if (error) throw error;
      return data as MemberRow | null;
    },
  });

  const historyQuery = useQuery({
    queryKey: ["member-attendance", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("member_id", memberId)
        .order("service_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });

  const followUpsQuery = useQuery({
    queryKey: ["member-followups", memberId],
    queryFn: async () => {
      const { data } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("member_id", memberId)
        .order("contacted_on", { ascending: false });
      return data ?? [];
    },
  });

  const m = memberQuery.data;

  if (memberQuery.isLoading) {
    return (
      <AppShell title="Member" back="/members">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }
  if (!m) {
    return (
      <AppShell title="Member" back="/members">
        <p className="text-sm text-muted-foreground">This member could not be found.</p>
      </AppShell>
    );
  }

  async function deleteAccount() {
    if (!m?.user_id) return;
    setDeleting(true);
    try {
      await deleteUserAccount({ data: { userId: m.user_id } });
      await queryClient.invalidateQueries({ queryKey: ["member", memberId] });
      await queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Account and all records deleted");
      setConfirmDelete(false);
      void navigate({ to: "/members" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete account");
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <AppShell title="Edit member" subtitle={m.full_name} back="/members">
        <MemberForm
          memberId={m.id}
          submitLabel="Update member"
          initial={{
            full_name: m.full_name,
            phone: m.phone ?? "",
            email: m.email ?? "",
            home_address: m.home_address ?? "",
            gender: m.gender ?? "",
            birth_month: m.birth_month ? String(m.birth_month) : "",
            birth_day: m.birth_day ? String(m.birth_day) : "",
            age_bracket: m.age_bracket ?? "",
            anniversary_month: m.anniversary_month ? String(m.anniversary_month) : "",
            anniversary_day: m.anniversary_day ? String(m.anniversary_day) : "",
            marital_status: m.marital_status ?? "",
            department: m.department ?? "",
            membership_year: m.membership_year ? String(m.membership_year) : "",
            photo_url: m.photo_url,
          }}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["member", memberId] });
            await queryClient.invalidateQueries({ queryKey: ["members"] });
            setEditing(false);
          }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={m.full_name}
      subtitle={m.member_code}
      back="/members"
      action={
        <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
      }
    >
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <MemberPhoto path={m.photo_url} name={m.full_name} size={72} />
        <div className="min-w-0">
          <p className="text-lg font-semibold">{m.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {m.department ?? "No department"} · joined {m.membership_year ?? "—"}
          </p>
          {m.is_first_timer && (
            <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
              First-time visitor
            </span>
          )}
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-2 text-base font-semibold">Details</h2>
        <Row label="Member ID" value={m.member_code} />
        <Row label="Phone" value={m.phone} />
        <Row label="Email" value={m.email} />
        <Row label="Home address" value={m.home_address} />
        <Row label="Gender" value={m.gender} />
        <Row
          label="Date of birth"
          value={m.birth_month ? `${m.birth_day ?? ""} ${MONTHS[m.birth_month - 1]}` : null}
        />
        <Row label="Age bracket" value={m.age_bracket} />
        <Row label="Marital status" value={m.marital_status} />
        <Row
          label="Wedding anniversary"
          value={
            m.anniversary_month ? `${m.anniversary_day ?? ""} ${MONTHS[m.anniversary_month - 1]}` : null
          }
        />
      </section>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Attendance history</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/followup" })}>
            Log follow-up
          </Button>
        </div>
        {(historyQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            No attendance recorded yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {(historyQuery.data ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm"
              >
                <span>
                  <span className="block font-medium">{formatDate(a.service_date)}</span>
                  <span className="block text-xs text-muted-foreground">{a.service_type}</span>
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    a.status === "Present"
                      ? "bg-success/10 text-success"
                      : a.status === "Late"
                        ? "bg-warning/15 text-warning-foreground"
                        : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-base font-semibold">Follow-up records</h2>
        {(followUpsQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
            No follow-up recorded yet.{" "}
            <Link to="/followup" className="font-medium text-primary underline-offset-4 hover:underline">
              Add one
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {(followUpsQuery.data ?? []).map((f) => (
              <li key={f.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{f.contact_method}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(f.contacted_on)}</span>
                </div>
                {f.situation && f.situation !== "None" && (
                  <p className="mt-1 text-xs text-muted-foreground">Situation: {f.situation}</p>
                )}
                {f.notes && <p className="mt-1 text-muted-foreground">{f.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isFullAccess && m.user_id && m.user_id !== auth?.userId && (
        <section className="mt-6">
          <Button
            variant="outline"
            className="w-full border-destructive/40 text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="mr-2 size-4" /> Delete account
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Permanently removes this person, their profile, attendance and follow-up records.
          </p>
        </section>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently wipes {m.full_name} from the database — profile, attendance and
              follow-up records included. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void deleteAccount();
              }}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
