import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./shepherd";

export type AuthInfo = {
  userId: string;
  email: string | null;
  fullName: string;
  department: string | null;
  role: AppRole;
};

export const authQueryKey = ["shepherd-auth"] as const;

export async function fetchAuthInfo(): Promise<AuthInfo | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [profileRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("full_name, department").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
  const priority: AppRole[] = [
    "senior_pastor",
    "follow_up_team",
    "attendance_officer",
    "department_leader",
    "floor_member",
  ];
  const role = priority.find((r) => roles.includes(r)) ?? "floor_member";

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profileRes.data?.full_name || (user.email ?? "Member"),
    department: profileRes.data?.department ?? null,
    role,
  };
}

export function useAuth() {
  const query = useQuery({ queryKey: authQueryKey, queryFn: fetchAuthInfo, staleTime: 30_000 });
  const auth = query.data ?? null;
  const role = auth?.role ?? "floor_member";
  const isFloor = role === "floor_member";

  return {
    auth,
    loading: query.isLoading,
    role,
    isFloor,
    isStaff: !isFloor,
    canManageMembers: role === "senior_pastor" || role === "follow_up_team" || role === "attendance_officer",
    canFollowUp: role !== "floor_member",
    isAdmin: role === "senior_pastor",
  };
}
