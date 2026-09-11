import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { MemberPhoto } from "@/components/MemberPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CONTACT_METHODS, SITUATIONS, formatDate, lastSundays, todayISO } from "@/lib/shepherd";
import { useMembers, useAttendance, type MemberRow, type AttendanceRow } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/followup")({
  // The tile can be opened as a plain list, or focused on one member via ?memberId=
  validateSearch: (search: Record<string, unknown>) => ({
    memberId: typeof search["memberId"] === "string" ? search["memberId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Follow-up — Shepherd" },
      { name: "description", content: "Members who missed consecutive Sunday Services and need pastoral follow-up." },
      { property: "og:title", content: "Follow-up — Shepherd" },
      { property: "og:description", content: "Log pastoral care contacts and notes for members." },
    ],
  }),
  component: FollowUp,
});

/** How many recent Sundays we look back over when counting absences. */
const LOOKBACK_SUNDAYS = 8;

/**
 * Absence tracking only starts from this Sunday. Anything before this date is
 * ignored, so nobody appears in follow-up until they miss Sundays from here on.
 */
const TRACKING_START = "2026-09-13";

/**
 * Counts how many of the most recent Sunday Services a member missed in a row.
 * Stops counting at the first Sunday the member was recorded as present.
 */
function consecutiveMissedSundays(
  memberId: string,
  sundays: string[],
  attendance: AttendanceRow[],
): number {
  // Build a quick lookup of "member attended on this Sunday" keys.
  const attended = new Set(
    attendance
      .filter((a) => a.service_type === "Sunday Service" && a.status !== "Absent")
      .map((a) => `${a.member_id}:${a.service_date}`),
  );
  let missed = 0;
  for (const s of sundays) {
    if (attended.has(`${memberId}:${s}`)) break;
    missed += 1;
  }
  return missed;
}

function FollowUp() {
  const { isFloor } = useAuth();
  const search = useSearch({ from: "/_authenticated/followup" });

  // Floor members do not have access to the pastoral care log at all.
  if (isFloor) {
    return (
      <AppShell title="Follow-up">
        <EmptyState title="Not available for floor members" hint="Church leaders record follow-up here." />
      </AppShell>
    );
  }

  // With a member selected we show the form; otherwise the list of who needs follow-up.
  return search.memberId ? <FollowUpForm memberId={search.memberId} /> : <FollowUpList />;
}

/** List view: only members who missed two or more consecutive Sunday Services. */
function FollowUpList() {
  const navigate = useNavigate();
  const { data: members = [] } = useMembers();
  // Only Sunday Services on or after the tracking start date count towards follow-up.
  const sundays = lastSundays(LOOKBACK_SUNDAYS).filter((d) => d >= TRACKING_START);
  const { data: attendance = [] } = useAttendance(sundays.at(-1) ?? TRACKING_START);

  // Work out the missed-service count per member and keep only those at two or more.
  const needsFollowUp = useMemo(() => {
    return members
      .map((m) => ({ member: m, missed: consecutiveMissedSundays(m.id, sundays, attendance) }))
      .filter((row) => row.missed >= 2)
      .sort((a, b) => b.missed - a.missed || a.member.full_name.localeCompare(b.member.full_name));
  }, [members, attendance, sundays.join(",")]);

  return (
    <AppShell title="Follow-up" subtitle="Members needing a pastoral contact">
      {needsFollowUp.length === 0 ? (
        <EmptyState
          title="No one needs follow-up"
          hint="Everyone has attended a Sunday Service recently."
        />
      ) : (
        <ul className="space-y-2">
          {needsFollowUp.map(({ member, missed }) => (
            <li key={member.id}>
              {/* Tapping a member opens the follow-up form already set to that person. */}
              <button
                type="button"
                onClick={() => navigate({ to: "/followup", search: { memberId: member.id } })}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left"
              >
                <MemberPhoto path={member.photo_url} name={member.full_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{member.full_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {member.department ?? "No department"} · {member.member_code}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                  {missed >= LOOKBACK_SUNDAYS ? `${LOOKBACK_SUNDAYS}+` : missed} missed
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

/** Form view: record a follow-up contact for the member that was tapped. */
function FollowUpForm({ memberId }: { memberId: string }) {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: members = [] } = useMembers();
  const member: MemberRow | undefined = members.find((m) => m.id === memberId);

  // Form state for a single follow-up entry.
  const [method, setMethod] = useState<string>(CONTACT_METHODS[0]);
  const [situation, setSituation] = useState<string>("None");
  const [contactedOn, setContactedOn] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Past follow-ups recorded for this member only.
  const list = useQuery({
    queryKey: ["follow-ups", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("member_id", memberId)
        .order("contacted_on", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Save the follow-up record, then refresh the history list.
  async function save() {
    setSaving(true);
    const { error } = await supabase.from("follow_ups").insert({
      member_id: memberId,
      contact_method: method,
      situation,
      contacted_on: contactedOn,
      notes: notes || null,
      created_by: auth?.userId ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes("");
    toast.success("Follow-up recorded");
    await queryClient.invalidateQueries({ queryKey: ["follow-ups", memberId] });
  }

  return (
    <AppShell
      title={member?.full_name ?? "Follow-up"}
      subtitle={member ? `${member.department ?? "No department"} · ${member.member_code}` : ""}
    >
      {/* Back to the list of members needing follow-up. */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 -ml-2"
        onClick={() => navigate({ to: "/followup", search: { memberId: undefined } })}
      >
        <ChevronLeft className="mr-1 h-4 w-4" /> All follow-ups
      </Button>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Contact method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_METHODS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Situation</Label>
            <Select value={situation} onValueChange={setSituation}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUATIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Date contacted</Label>
          <Input
            type="date"
            className="mt-1"
            value={contactedOn}
            onChange={(e) => setContactedOn(e.target.value)}
          />
        </div>

        <div>
          <Label>Follow-up notes</Label>
          <Textarea
            className="mt-1"
            rows={3}
            placeholder="What was discussed?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Record follow-up"}
        </Button>
      </div>

      <h2 className="mb-3 mt-6 text-base font-semibold">Previous follow-ups</h2>
      {(list.data ?? []).length === 0 ? (
        <EmptyState title="No follow-ups recorded yet" />
      ) : (
        <ul className="space-y-2">
          {(list.data ?? []).map((f: any) => (
            <li key={f.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.contact_method}</span>
                <span className="text-xs text-muted-foreground">{formatDate(f.contacted_on)}</span>
              </div>
              {f.situation && f.situation !== "None" && (
                <p className="text-xs text-muted-foreground">{f.situation}</p>
              )}
              {f.notes && <p className="mt-1 text-muted-foreground">{f.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
