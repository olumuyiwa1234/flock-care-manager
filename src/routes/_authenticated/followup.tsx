import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
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
import * as XLSX from "xlsx";
import { Download, History } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CONTACT_METHODS,
  SITUATIONS,
  fellowshipOf,
  formatDate,
  lastSundays,
  todayISO,
} from "@/lib/shepherd";
import { useMembers, useAttendance, type MemberRow } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import { isYouthMember, missedSundayCount } from "@/lib/follow-up-counts";
import { useFollowUpDates } from "@/lib/useFollowUpDates";

export const Route = createFileRoute("/_authenticated/followup")({
  // The tile can be opened as a plain list, or focused on one member via ?memberId=
  validateSearch: (search: Record<string, unknown>) => ({
    memberId: typeof search["memberId"] === "string" ? search["memberId"] : undefined,
    // "history" opens the past follow-up reports sub-tile.
    view: search["view"] === "history" ? ("history" as const) : undefined,
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
  if (search.view === "history") return <FollowUpHistory />;
  return search.memberId ? <FollowUpForm memberId={search.memberId} /> : <FollowUpList />;
}

/** List view: only members who missed two or more consecutive Sunday Services. */
function FollowUpList() {
  const navigate = useNavigate();
  const { data: members = [] } = useMembers();
  const { role, subRole, isFullAccess, isFollowUp } = useAuth();
  // Only Sunday Services on or after the tracking start date count towards follow-up.
  const sundays = lastSundays(LOOKBACK_SUNDAYS).filter((d) => d >= TRACKING_START);
  const { data: attendance = [] } = useAttendance(sundays.at(-1) ?? TRACKING_START);
  // Full attendance history, used only to show when each member was last seen.
  const { data: allAttendance = [] } = useAttendance();

  // Completed contacts reset the shared adult and youth absence counters.
  const lastFollowUps = useFollowUpDates();

  // Natural group leaders are limited to the fellowship(s) they lead.
  const leaderGroups = useMemo(
    () =>
      (subRole ?? "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [subRole],
  );
  const restrictToGroup = role === "group_leader" && !isFullAccess && !isFollowUp;

  // Most recent date each member was actually present, for the "last seen" column.
  const lastSeen = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of allAttendance) {
      if (a.status === "Absent") continue;
      const current = map.get(a.member_id);
      if (!current || a.service_date > current) map.set(a.member_id, a.service_date);
    }
    return map;
  }, [allAttendance]);

  // Work out the missed-service count per member and keep only those at two or more.
  const needsFollowUp = useMemo(() => {
    return members
      .filter((m) => {
        // Children and teens now have their own missed-Sunday sub-tiles.
        if (isYouthMember(m)) return false;
        if (!restrictToGroup) return true;
        // Use the saved natural group, falling back to the derived fellowship.
        const group =
          m.natural_group ?? fellowshipOf(m.gender, m.marital_status, m.age_bracket);
        return !!group && leaderGroups.includes(group.toLowerCase());
      })
      .map((m) => {
        // Share registration-date and completed-follow-up reset rules with youth lists.
        return { member: m, missed: missedSundayCount(m, sundays, attendance, lastFollowUps.data?.get(m.id)) };
      })
      .filter((row) => row.missed >= 2)
      .sort((a, b) => b.missed - a.missed || a.member.full_name.localeCompare(b.member.full_name));
  }, [members, attendance, sundays.join(","), restrictToGroup, leaderGroups, lastFollowUps.data]);

  // Build an Excel workbook of the whole follow-up list and download it.
  // Full-access users (Pastor, Parish Coordinator, Admin) export every member
  // who needs follow-up; natural group leaders export only their own group.
  function exportExcel() {
    if (needsFollowUp.length === 0) {
      toast.info("No one needs follow-up yet, so there is nothing to export.");
      return;
    }
    const rows = needsFollowUp.map(({ member, missed }) => ({
      Name: member.full_name,
      Gender: member.gender ?? "",
      "Phone Number": member.phone ?? "",
      "House Address": member.home_address ?? "",
      "Last Seen": lastSeen.get(member.id) ? formatDate(lastSeen.get(member.id)) : "Never",
      "Sunday Services Missed": missed,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Follow-up");
    XLSX.writeFile(book, `follow-up-${todayISO()}.xlsx`);
  }

  return (
    <AppShell title="Follow-up" subtitle="Members needing a pastoral contact">
      {/* Download the same list shown below as a spreadsheet. Always visible so
          leaders can find it even when the list is currently empty. */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <Download className="mr-1 h-4 w-4" /> Export to Excel
        </Button>
        {/* Sub-tile: past follow-up reports. */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: "/followup", search: { memberId: undefined, view: "history" } })}
        >
          <History className="mr-1 h-4 w-4" /> Past follow-ups
        </Button>
      </div>
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
                onClick={() => navigate({ to: "/followup", search: { memberId: member.id, view: undefined } })}
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
                  {/* Exact number of tracked Sunday Services missed in a row. */}
                  {missed} missed
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
  // Optional: flag this follow-up for the Pastor's attention.
  const [escalate, setEscalate] = useState(false);
  // true = member stays in the Follow-up list after this record (e.g. unreachable).
  const [keepOpen, setKeepOpen] = useState(false);

  // Past follow-ups recorded for this member only, including who recorded each
  // one (joined from the profiles table via the created_by foreign key).
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
      // Attach the recorder's name (created_by has no FK to profiles).
      return (await withRecorderNames(data ?? [])) as any[];
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
      escalated: escalate,
      keep_open: keepOpen,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotes("");
    setEscalate(false);
    setKeepOpen(false);
    toast.success(
      keepOpen
        ? "Follow-up recorded — member stays in the follow-up list"
        : escalate ? "Follow-up recorded and sent to the Pastor" : "Follow-up recorded",
    );
    queryClient.invalidateQueries({ queryKey: ["follow-ups-all"] });
    // Refresh history, the list (member drops off) and the Pastor's alerts.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["follow-ups", memberId] }),
      queryClient.invalidateQueries({ queryKey: ["follow-ups-latest"] }),
      queryClient.invalidateQueries({ queryKey: ["follow-ups-all"] }),
      queryClient.invalidateQueries({ queryKey: ["follow-up-escalations"] }),
    ]);
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
        onClick={() => navigate({ to: "/followup", search: { memberId: undefined, view: undefined } })}
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

        {/* Where this member goes after saving: stay in the list or move to past follow-ups. */}
        <div className="space-y-1">
          <Label>After recording</Label>
          <Select value={keepOpen ? "keep" : "move"} onValueChange={(v) => setKeepOpen(v === "keep")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="move">Move to past follow-ups</SelectItem>
              <SelectItem value="keep">Keep in follow-up (e.g. not reachable)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Optional escalation: notifies the Pastor about this follow-up. */}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={escalate} onCheckedChange={(v) => setEscalate(v === true)} />
          Escalate to Pastor (needs the Pastor's attention)
        </label>

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
                <span className="font-medium">
                  {f.contact_method}
                  {f.escalated && <span className="ml-2 text-xs text-destructive">Escalated</span>}
                </span>
                <span className="text-xs text-muted-foreground">{formatDate(f.contacted_on)}</span>
              </div>
              {/* Show who recorded this follow-up, when we know their name. */}
              {f.profiles?.full_name && (
                <p className="text-xs text-muted-foreground">Recorded by {f.profiles.full_name}</p>
              )}
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

/** Sub-tile: every past follow-up report, newest first, with a name search. */
function FollowUpHistory() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  // Load all follow-ups the user may see (RLS scopes them), with member names.
  const all = useQuery({
    queryKey: ["follow-ups-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        // Member names come from the direct members foreign key.
        .select("*, members(full_name, member_code)")
        // Only follow-ups the logger chose to move to past follow-ups.
        .eq("keep_open", false)
        .order("contacted_on", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Attach the recorder's name (created_by has no FK to profiles).
      return (await withRecorderNames(data ?? [])) as any[];
    },
  });
  // Filter by member name as the user types.
  const rows = (all.data ?? []).filter((f) =>
    (f.members?.full_name ?? "").toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <AppShell title="Past follow-ups" subtitle="Follow-up reports history">
      <Button
        variant="ghost"
        size="sm"
        className="mb-3 -ml-2"
        onClick={() => navigate({ to: "/followup", search: { memberId: undefined, view: undefined } })}
      >
        <ChevronLeft className="mr-1 h-4 w-4" /> Follow-up list
      </Button>
      <Input className="mb-3" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} />
      {rows.length === 0 ? (
        <EmptyState title={all.isLoading ? "Loading…" : "No follow-up reports yet"} />
      ) : (
        <ul className="space-y-2">
          {rows.map((f) => (
            <li key={f.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Link to="/members/$memberId" params={{ memberId: f.member_id }} className="font-medium text-primary">
                  {f.members?.full_name ?? "Member"}
                </Link>
                <span className="text-xs text-muted-foreground">{formatDate(f.contacted_on)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {f.contact_method}
                {f.situation && f.situation !== "None" ? ` · ${f.situation}` : ""}
                {f.escalated && <span className="ml-2 text-destructive">Escalated to Pastor</span>}
              </p>
              {/* Show who recorded this follow-up, when we know their name. */}
              {f.profiles?.full_name && (
                <p className="text-xs text-muted-foreground">Recorded by {f.profiles.full_name}</p>
              )}
              {f.notes && <p className="mt-1 text-muted-foreground">{f.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

/**
 * Looks up the profile name of whoever recorded each follow-up (created_by)
 * in one query and attaches it as `profiles.full_name` on every row.
 * If names can't be read, rows are still returned without them.
 */
async function withRecorderNames<T extends { created_by: string | null }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  if (ids.length === 0) return rows.map((r) => ({ ...r, profiles: null }));
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  const names = new Map((data ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({
    ...r,
    profiles: r.created_by && names.has(r.created_by) ? { full_name: names.get(r.created_by) } : null,
  }));
}
