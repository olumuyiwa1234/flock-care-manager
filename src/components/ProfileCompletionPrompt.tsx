import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { UserRoundPen, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";

type Row = {
  full_name: string | null;
  photo_url: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  birth_month: number | null;
  birth_day: number | null;
  age_bracket: string | null;
  marital_status: string | null;
  membership_year: number | null;
};

const LABELS: Record<string, string> = {
  full_name: "Full name",
  photo_url: "Photo",
  phone: "Phone number",
  email: "Email address",
  gender: "Gender",
  birthday: "Birthday",
  age_bracket: "Age bracket",
  marital_status: "Marital status",
  membership_year: "Membership year",
};

function missingFields(m: Row): string[] {
  const missing: string[] = [];
  if (!m.full_name?.trim()) missing.push("full_name");
  if (!m.photo_url) missing.push("photo_url");
  if (!m.phone?.trim()) missing.push("phone");
  if (!m.email?.trim()) missing.push("email");
  if (!m.gender) missing.push("gender");
  if (!m.birth_month || !m.birth_day) missing.push("birthday");
  if (!m.age_bracket) missing.push("age_bracket");
  if (!m.marital_status) missing.push("marital_status");
  if (!m.membership_year) missing.push("membership_year");
  return missing;
}

/** Reminds already-registered users to fill in details that are now required. */
export function ProfileCompletionPrompt() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const userId = auth?.userId;

  const { data } = useQuery({
    queryKey: ["profile-completion", userId ?? "anon"],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data: row } = await supabase
        .from("members")
        .select(
          "full_name, photo_url, phone, email, gender, birth_month, birth_day, age_bracket, marital_status, membership_year",
        )
        .eq("user_id", userId!)
        .maybeSingle();
      return row ? missingFields(row as Row) : [];
    },
  });

  if (dismissed || !data || data.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <UserRoundPen size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Complete your profile</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please add: {data.map((k) => LABELS[k]).join(", ")}.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setDismissed(true);
                  navigate({ to: "/profile" });
                }}
              >
                Update now
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                Later
              </Button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setDismissed(true)}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
