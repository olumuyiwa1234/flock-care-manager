import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Baby,
  Cake,
  Bell,
  CalendarDays,
  ClipboardList,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Lightbulb,
  Inbox,
  MessageSquareHeart,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { ROLE_LABELS } from "@/lib/shepherd";
import { useNotifications } from "@/lib/useNotifications";
import { usePendingApprovals } from "./approvals";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Shepherd" },
      { name: "description", content: "Your Shepherd home screen: check in, members, attendance, follow-up and reports." },
      { property: "og:title", content: "Home — Shepherd" },
      { property: "og:description", content: "Check in members and manage your church records." },
    ],
  }),
  component: Home,
});

const tiles = [
  { to: "/checkin", label: "Check In", icon: CalendarDays, staffOnly: false },
  { to: "/members", label: "Members", icon: Users, staffOnly: true },
  { to: "/children", label: "Children", icon: Baby, staffOnly: true, childrenOnly: true },
  { to: "/attendance", label: "Attendance", icon: ClipboardList, staffOnly: true },
  { to: "/followup", label: "Follow-up", icon: HeartHandshake, staffOnly: true },
  { to: "/celebrations", label: "Celebration", icon: Cake, staffOnly: true },
  { to: "/reports", label: "Reports", icon: BarChart3, staffOnly: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, staffOnly: true },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, staffOnly: true, pastorOnly: true },
  { to: "/inbox", label: "Pastor Inbox", icon: Inbox, staffOnly: true, pastorOnly: true },
  { to: "/roles", label: "User Roles", icon: UserCog, staffOnly: true, pastorOnly: true },
  { to: "/profile", label: "My Profile", icon: UserRound, staffOnly: false },
  { to: "/feedback", label: "Feedback", icon: Lightbulb, staffOnly: false },
  { to: "/contact-pastor", label: "Contact Pastor", icon: MessageSquareHeart, staffOnly: false },
  { to: "/settings", label: "Settings", icon: Settings, staffOnly: true },
];

function Home() {
  const { auth, isFloor, role, isChildrenLeader, isAdmin, isPastor, pending } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items } = useNotifications();
  const { data: approvals } = usePendingApprovals(isPastor);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const visible = tiles.filter(
    (t) =>
      (!t.staffOnly || !isFloor) &&
      (!("childrenOnly" in t) || isChildrenLeader || isAdmin) &&
      (!("pastorOnly" in t) || isPastor),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sky-gradient px-5 pb-10 pt-8 text-primary-foreground">
        <div className="mx-auto max-w-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.3em] opacity-70">Shepherd</p>
              <h1 className="mt-2 text-2xl font-semibold">
                {auth?.fullName
                  ? `Peace be with you, ${auth.fullName.split(" ")[0]}.`
                  : "Peace be with you."}
              </h1>
              <p className="mt-1 text-sm opacity-80">{ROLE_LABELS[role]}</p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/notifications"
                className="relative grid size-10 place-items-center rounded-full bg-primary-foreground/15"
                aria-label="Notifications"
              >
                <Bell className="size-5" />
                {items.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                    {items.length}
                  </span>
                )}
              </Link>
              <button
                onClick={signOut}
                className="grid size-10 place-items-center rounded-full bg-primary-foreground/15"
                aria-label="Sign out"
              >
                <LogOut className="size-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-xl px-5 pb-16">
        {pending && (
          <div className="mb-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-tile">
            Your leadership access is awaiting a pastor's approval. You can check in meanwhile.
          </div>
        )}
        {isPastor && (approvals?.length ?? 0) > 0 && (
          <Link
            to="/approvals"
            className="mb-4 block rounded-2xl border border-primary/30 bg-secondary p-4 text-sm font-medium text-primary shadow-tile"
          >
            {approvals?.length} access request{(approvals?.length ?? 0) > 1 ? "s" : ""} awaiting your approval
          </Link>
        )}
        <Link
          to="/checkin"
          className="mb-4 flex items-center gap-4 rounded-3xl bg-card p-5 shadow-float transition active:scale-[0.99]"
        >
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-sky-gradient text-primary-foreground">
            <CalendarDays className="size-7" />
          </span>
          <span>
            <span className="block text-lg font-semibold">Check In</span>
            <span className="block text-sm text-muted-foreground">
              Tap when you arrive at the church premises
            </span>
          </span>
        </Link>

        <div className="grid grid-cols-2 gap-4">
          {visible
            .filter((t) => t.to !== "/checkin")
            .map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex aspect-square flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-tile transition active:scale-[0.98]"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                  <Icon className="size-6" />
                </span>
                <span className="text-lg font-semibold">{label}</span>
              </Link>
            ))}
        </div>
      </main>
    </div>
  );
}
