import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { AppShell, StatTile } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/useAuth";
import { useMembers, useAttendance } from "@/lib/queries";
import { todayISO } from "@/lib/shepherd";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Shepherd" },
      { name: "description", content: "Live totals for members, attendance, absentees and first-time visitors, filterable by date." },
      { property: "og:title", content: "Dashboard — Shepherd" },
      { property: "og:description", content: "Live church attendance overview with a date filter." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { isFloor } = useAuth();

  // Selected day drives which attendance records the stats count.
  // Defaults to today so the dashboard opens on the current picture.
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedISO = selectedDate.toISOString().slice(0, 10);
  const isToday = selectedISO === todayISO();

  // Load the member roster (all-time totals) and attendance from the
  // selected date onward; we narrow to the exact date below.
  const { data: members = [] } = useMembers();
  const { data: attendance = [] } = useAttendance(selectedISO);

  // Members recorded as present (or late) on the selected day.
  const presentSet = new Set(
    attendance
      .filter((a) => a.service_date === selectedISO && a.status !== "Absent")
      .map((a) => a.member_id),
  );

  // First-timers whose record was created on the selected day.
  const firstTimers = members.filter(
    (m) => m.is_first_timer && m.created_at.slice(0, 10) === selectedISO,
  );

  return (
    <AppShell
      title="Dashboard"
      subtitle={isToday ? "Today at a glance" : format(selectedDate, "EEE, d MMM yyyy")}
      // Date filter lives in the header action slot so it is always reachable.
      action={
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn("border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground")}
              aria-label="Filter dashboard by date"
            >
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, "d MMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {!isFloor && (
          <>
            <StatTile label="Total members" value={members.length} to="/members" />
            <StatTile
              label={isToday ? "Present today" : "Present on date"}
              value={presentSet.size}
              tone="good"
              to="/attendance"
            />
            <StatTile
              label={isToday ? "Absent today" : "Absent on date"}
              value={Math.max(members.length - presentSet.size, 0)}
              tone="warn"
            />
            <StatTile label="First-time visitors" value={firstTimers.length} />
          </>
        )}
      </div>
    </AppShell>
  );
}
