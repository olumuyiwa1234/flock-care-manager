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
  component: Attendance;
});

function Attendance() {
  return null;
}
