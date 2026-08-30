import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { MemberPhoto } from "@/components/MemberPhoto";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ATTENDANCE_STATUSES, SERVICE_TYPES, todayISO } from "@/lib/shepherd";
import { useAttendance, useMembers } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Shepherd" },
      { name: "description", content: "Mark and review attendance for Sunday, midweek and special services." },
      { property: "og:title", content: "Attendance — Shepherd" },
      { property: "og:description", content: "Record present, late and absent members per service." },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { auth, isFloor } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
  const { data: members = [] } = useMembers();
  const { data: records = [], isLoading } = useAttendance(date);

  const statusByMember = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) {
      if (r.service_date === date && r.service_type === serviceType) map.set(r.member_id, r.status);
    }
    return map;
  }, [records, date, serviceType]);

  async function setStatus(memberId: string, status: string) {
    const { error } = await supabase.from("attendance").upsert(
      {
        member_id: memberId,
        service_date: date,
        service_type: serviceType,
        status,
        recorded_by: auth?.userId ?? null,
      },
      { onConflict: "member_id,service_date,service_type" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
  }

  if (isFloor) {
    return (
      <AppShell title="Attendance">
        <EmptyState title="Not available for floor members" hint="Use Check In to record your own attendance." />
      </AppShell>
    );
  }

  const presentCount = [...statusByMember.values()].filter((s) => s !== "Absent").length;

  return (
    <AppShell title="Attendance" subtitle={`${presentCount} marked present`}>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
          <Input type="date" className="mt-1" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Service</Label>
          <Select value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : members.length === 0 ? (
        <EmptyState title="No members yet" hint="Add members before recording attendance." />
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const status = statusByMember.get(m.id);
            return (
              <li key={m.id} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <MemberPhoto path={m.photo_url} name={m.full_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.member_code}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {ATTENDANCE_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void setStatus(m.id, s)}
                      className={`rounded-xl px-2 py-2 text-sm font-medium transition ${
                        status === s
                          ? s === "Present"
                            ? "bg-success text-primary-foreground"
                            : s === "Late"
                              ? "bg-warning text-warning-foreground"
                              : "bg-destructive text-destructive-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
