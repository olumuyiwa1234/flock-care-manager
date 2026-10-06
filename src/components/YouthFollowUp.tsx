import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, EmptyState } from "@/components/AppShell";
import { MemberPhoto } from "@/components/MemberPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAttendance, useMembers } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import { lastSundays } from "@/lib/shepherd";
import { missedSundayCount } from "@/lib/follow-up-counts";
import { useFollowUpDates } from "@/lib/useFollowUpDates";

/** Each department gets the same absence rules, but only its own age bracket. */
export function YouthFollowUp({ group }: { group: "children" | "teens" }) {
  const { isStaff, isChildrenLeader, isTeensLeader } = useAuth();
  const members = useMembers();
  // Match the existing follow-up tracking window and initial tracking date.
  const sundays = lastSundays(8).filter((date) => date >= "2026-09-13");
  const attendance = useAttendance(sundays.at(-1) ?? "2026-09-13");
  const contacts = useFollowUpDates();
  const [search, setSearch] = useState("");
  const children = group === "children";
  const title = children ? "Children follow-up" : "Teens follow-up";
  const allowed = isStaff || (children ? isChildrenLeader : isTeensLeader);
  const loading = members.isLoading || attendance.isLoading || contacts.isLoading;
  const error = members.isError || attendance.isError || contacts.isError;

  // Wait for all three sources so a completed follow-up never briefly appears as overdue.
  const rows = (members.data ?? [])
    .filter((member) => !member.is_first_timer && member.age_bracket === (children ? "0-12" : "13-17"))
    .map((member) => ({ member, missed: missedSundayCount(member, sundays, attendance.data ?? [], contacts.data?.get(member.id)) }))
    .filter(({ member, missed }) => missed >= 2 && member.full_name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.missed - a.missed || a.member.full_name.localeCompare(b.member.full_name));

  return (
    <AppShell title={title} back={children ? "/children" : "/teens"} subtitle="Missed 2 or more consecutive Sunday services">
      {/* Preserve the department's access rules and expose loading/failure separately from an empty list. */}
      {!allowed ? <EmptyState title="Not available" /> : <>
        <Input className="mb-4" aria-label="Search by name" placeholder="Search by name" value={search} onChange={(event) => setSearch(event.target.value)} />
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading follow-ups…</p>
          : error ? <EmptyState title="Could not load follow-ups" hint="Please try again." />
          : rows.length === 0 ? <EmptyState title={search ? "No names match" : "No one needs follow-up"} />
          : <ul className="space-y-2">
            {rows.map(({ member, missed }) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
                <MemberPhoto path={member.photo_url} name={member.full_name} />
                <div className="min-w-0 flex-1">
                  {/* Names open profiles, while the separate action opens the existing contact form. */}
                  <Link to="/members/$memberId" params={{ memberId: member.id }} className="block break-words font-medium text-primary hover:underline">{member.full_name}</Link>
                  <p className="text-xs text-muted-foreground">{missed} consecutive Sundays missed</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/followup" search={{ memberId: member.id, view: undefined }}>Record follow-up</Link>
                </Button>
              </li>
            ))}
          </ul>}
      </>}
    </AppShell>
  );
}