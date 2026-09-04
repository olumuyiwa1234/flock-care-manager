import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./shepherd";

export type AuthInfo = {
  userId: string;
  email: string | null;
  fullName: string;
  department: string | null;
  subRole: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  role: AppRole;
};

export const authQueryKey = ["shepherd-auth"] as const;

export async function fetchAuthInfo(): Promise<AuthInfo | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  const [profileRes, rolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, department, sub_role, approval_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
  const priority: AppRole[] = [
    "pastorate",
    "it_infrastructure",
    "follow_up",
    "hod",
    "group_leader",
    "member",
  ];
  const role = priority.find((r) => roles.includes(r)) ?? "member";
  const profile = profileRes.data as
    | { full_name: string; department: string | null; sub_role: string | null; approval_status: string }
    | null;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name || "friend",
    department: profile?.department ?? null,
    subRole: profile?.sub_role ?? null,
    approvalStatus: (profile?.approval_status ?? "pending") as AuthInfo["approvalStatus"],
    role,
  };
}

export function useAuth() {
  const query = useQuery({ queryKey: authQueryKey, queryFn: fetchAuthInfo, staleTime: 30_000 });
  const auth = query.data ?? null;
  const role = auth?.role ?? "member";
  const approved = auth?.approvalStatus === "approved";

  const isFullAccess = approved && (role === "pastorate" || role === "it_infrastructure");
  const isFollowUp = approved && role === "follow_up";
  const isClusterLeader = approved && (role === "hod" || role === "group_leader");
  const isMemberOnly = !approved || role === "member";
  const isChildrenLeader =
    approved && role === "hod" && (auth?.subRole ?? "").toLowerCase() === "children";

  return {
    auth,
    loading: query.isLoading,
    role,
    subRole: auth?.subRole ?? null,
    approved,
    pending: auth?.approvalStatus === "pending",
    rejected: auth?.approvalStatus === "rejected",
    isFullAccess,
    isFollowUp,
    isClusterLeader,
    isMemberOnly,
    isFloor: isMemberOnly,
    isStaff: !isMemberOnly,
    canManageMembers: isFullAccess || isFollowUp,
    canFollowUp: isFullAccess || isFollowUp || isClusterLeader,
    isAdmin: isFullAccess,
    isPastor: approved && role === "pastorate",
    isChildrenLeader,
  };
}
