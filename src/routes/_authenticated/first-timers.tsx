import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MemberForm } from "@/components/MemberForm";
import { MemberPhoto } from "@/components/MemberPhoto";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMembers } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";
import { formatDate, fellowshipOf } from "@/lib/shepherd";

export const Route = createFileRoute("/_authenticated/first-timers")({
  head: () => ({
    meta: [
      { title: "First Timers — Shepherd" },
      { name: "description", content: "Register and view first-time visitors to the church." },
      { property: "og:title", content: "First Timers — Shepherd" },
      { property: "og:description", content: "Register and view first-time visitors to the church." },
    ],
  }),
  component: FirstTimers,
});

function FirstTimers() {
  // Roles that decide who may see and who may register first timers.
  const { isPastor, isAdmin, role, subRole, approved, isChildrenLeader, isTeensLeader } = useAuth();
  const subRoles = (subRole ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const isFollowUpHod = approved && role === "hod" && subRoles.includes("follow-up");
  // The follow-up team: the dedicated follow-up role plus the Follow-up HOD.
  const isFollowUpTeam = (approved && role === "follow_up") || isFollowUpHod;
  // Only the follow-up team (and the Pastor/Admin who oversee them) may register first timers.
  const canRegister = isPastor || isAdmin || isFollowUpTeam;
  // Natural group leaders get a read-only view of the first timers in their fellowship.
  const isGroupLeader = approved && role === "group_leader";
  const myFellowships = isGroupLeader ? subRoles : [];
  const canAccess = canRegister || isGroupLeader || isChildrenLeader || isTeensLeader;

  // All members visible to the signed-in user
  const { data: members = [] } = useMembers();
  const queryClient = useQueryClient();
  // Toggle between the visitor list and the registration form
  const [adding, setAdding] = useState(false);
  // Tracks which visitor is currently being moved to the members list
  const [converting, setConverting] = useState<string | null>(null);

  /**
   * Moves a first-time visitor into the members list once they register as a
   * member. The visitor record itself is kept — only the first-timer flag is
   * cleared, so all their details and registration date are preserved.
   */
  async function registerAsMember(id: string) {
    setConverting(id);
    const { error } = await supabase.from("members").update({ is_first_timer: false }).eq("id", id);
    setConverting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Added to members");
    await queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  // First-time visitors, most recently registered first. Natural group leaders
  // only see the visitors whose status places them in their own fellowship
  // (singles → Youth, married men under 50 → Men's, married women under 50 →
  // Good Women, anyone 50 and above → Elders).
  const firstTimers = members
    .filter((m) => m.is_first_timer)
    .filter((m) => {
      if (!isGroupLeader) return true;
      const fellowship = fellowshipOf(m.gender, m.marital_status, m.age_bracket);
      return !!fellowship && myFellowships.includes(fellowship.toLowerCase());
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Guard the page so it cannot be reached directly by users without the right role.
  if (!canAccess) {
    return (
      <AppShell title="First Timers" subtitle="Restricted" back="/home">
        <p className="text-sm text-muted-foreground">
          Only the follow-up team, Pastor, Admin, natural group leaders, Children HOD or Teens HOD
          can access first timers.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="First Timers" subtitle="First-time visitors" back="/home">
      {adding ? (
        // Registration form — saved visitors are flagged as first timers automatically
        <MemberForm
          isFirstTimer
          submitLabel="Save first timer"
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["members"] });
            setAdding(false);
          }}
        />
      ) : (
        <>
          {/* Only the follow-up team may add new first timers */}
          {canRegister && (
            <Button className="mb-4 w-full" size="lg" onClick={() => setAdding(true)}>
              <UserPlus className="size-4" /> Register a first timer
            </Button>
          )}

          {firstTimers.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
              No first-time visitors recorded yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {firstTimers.map((m) => (
                <li key={m.id}>
                  <Link
                    to="/members/$memberId"
                    params={{ memberId: m.id }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <MemberPhoto path={m.photo_url} name={m.full_name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.full_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {m.phone ?? "No phone"} · Registered {formatDate(m.created_at)}
                      </span>
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium text-primary">
                      First timer
                    </span>
                  </Link>
                  {/* Moves the visitor into the Members tile when they register as a member */}
                  {canRegister && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      disabled={converting === m.id}
                      onClick={() => void registerAsMember(m.id)}
                    >
                      {converting === m.id ? "Adding…" : "Register as member"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
