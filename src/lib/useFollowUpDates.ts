import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Share completed-contact dates so adult and youth lists reset together after recording a follow-up. */
export function useFollowUpDates() {
  return useQuery({
    queryKey: ["follow-ups-latest"],
    queryFn: async () => {
      // Unreachable/kept-open attempts must not reset the missed-Sunday streak.
      const { data, error } = await supabase.from("follow_ups")
        .select("member_id, contacted_on").eq("keep_open", false);
      if (error) throw error;
      const dates = new Map<string, string>();
      for (const row of data ?? []) {
        const previous = dates.get(row.member_id);
        if (!previous || row.contacted_on > previous) dates.set(row.member_id, row.contacted_on);
      }
      return dates;
    },
  });
}