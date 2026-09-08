import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SERVICE_TYPES, initials, todayISO, todaysService } from "@/lib/shepherd";
import { useAttendance, useMembers } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/children/")({
  head: () => ({
    meta: [
      { title: "Children Attendance — Shepherd" },
      {
        name: "description",
        content: "Children department leaders mark each child present or absent for today's service.",
      },
      { property: "og:title", content: "Children Attendance — Shepherd" },
      {
        property: "og:description",
        content: "Mark children present or absent without needing a phone for each child.",
      },
    ],
  }),
  component: ChildrenAttendance,
});

function ChildrenAttendance() {
  const { auth, isChildrenLeader, isStaff } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = todayISO();
  const { data: members = [], isLoading } = useMembers();
  const { data: attendance = [] } = useAttendance(today);
  const activeService = todaysService();
  const [serviceType, setServiceType] = useState<string>(activeService ?? SERVICE_TYPES[0]);
  const [busy, setBusy] = useState<string | null>(null);

  const children = useMemo(
    () => members.filter((m) => m.age_bracket === "0-12"),
    [members],
  );

  const statusFor = (memberId: string) =>
    attendance.find(
      (a) =>
        a.member_id === memberId && a.service_date === today && a.service_type === serviceType,
    )?.status ?? null;

  async function mark(memberId: string, status: "Present" | "Absent") {
    if (!activeService) {
      toast.error("No service is scheduled today. Attendance can only be marked on a service day.");
      return;
    }
    setBusy(memberId);
    const { error } = await supabase.from("attendance").upsert(
      {
        member_id: memberId,
        service_date: today,
        service_type: serviceType,
        status,
        check_in_time: new Date().toISOString(),
        recorded_by: auth?.userId ?? null,
      },
      { onConflict: "member_id,service_date,service_type" },
    );
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    toast.success(`Marked ${status.toLowerCase()}`);
  }

  if (!isChildrenLeader && !isStaff) {
    return (
      <AppShell title="Children" back="/home">
        <p className="text-sm text-muted-foreground">
          Only the children department leader can record children's attendance.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Children"
      subtitle="Mark present or absent"
      back="/home"
      action={
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="relative z-40 size-10 shrink-0 rounded-full touch-manipulation"
          aria-label="Add child"
          onClick={() => void navigate({ to: "/children/new" })}
        >
          <Plus className="size-5" />
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Service type
          </Label>
          <Select value={serviceType} onValueChange={setServiceType} disabled={!activeService}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="No service today" />
            </SelectTrigger>
            <SelectContent>
              {(activeService ? [activeService] : []).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!activeService && (
            <p className="mt-2 text-xs text-muted-foreground">
              No service is scheduled today. Attendance can only be marked on Sundays (Sunday
              Service), Tuesdays (Digging Deep) and Thursdays (Faith Clinic).
            </p>
          )}
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading children…</p>}
        {!isLoading && children.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No members in the 0–12 age bracket yet. Tap + to add a child.
          </p>
        )}

        <ul className="space-y-2">
          {children.map((c) => {
            const status = statusFor(c.id);
            return (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(c.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.member_code}
                    {status ? ` · ${status}` : ""}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant={status === "Present" ? "default" : "outline"}
                  className="rounded-full"
                  aria-label={`Mark ${c.full_name} present`}
                  disabled={busy === c.id || !activeService}
                  onClick={() => void mark(c.id, "Present")}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant={status === "Absent" ? "destructive" : "outline"}
                  className="rounded-full"
                  aria-label={`Mark ${c.full_name} absent`}
                  disabled={busy === c.id || !activeService}
                  onClick={() => void mark(c.id, "Absent")}
                >
                  <X className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
