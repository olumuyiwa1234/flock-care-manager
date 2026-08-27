import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MemberRow = {
  id: string;
  member_code: string;
  full_name: string;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  home_address: string | null;
  gender: string | null;
  birth_month: number | null;
  birth_year: number | null;
  age_bracket: string | null;
  anniversary_month: number | null;
  anniversary_day: number | null;
  marital_status: string | null;
  department: string | null;
  membership_year: number | null;
  is_first_timer: boolean;
  invited_by: string | null;
  user_id: string | null;
  created_at: string;
};

export type AttendanceRow = {
  id: string;
  member_id: string;
  service_date: string;
  service_type: string;
  status: string;
  check_in_time: string;
};

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });
}

export function useAttendance(sinceISO?: string) {
  return useQuery({
    queryKey: ["attendance", sinceISO ?? "all"],
    queryFn: async (): Promise<AttendanceRow[]> => {
      let q = supabase.from("attendance").select("*").order("service_date", { ascending: false });
      if (sinceISO) q = q.gte("service_date", sinceISO);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceRow[];
    },
  });
}

export function useChurchSettings() {
  return useQuery({
    queryKey: ["church-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("church_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
