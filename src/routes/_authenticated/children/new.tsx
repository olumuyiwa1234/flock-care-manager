import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthDayPicker } from "@/components/MonthDayPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { GENDERS } from "@/lib/shepherd";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/children/new")({
  head: () => ({
    meta: [
      { title: "Add child — Shepherd" },
      { name: "description", content: "Add a child member to the children department." },
      { property: "og:title", content: "Add child — Shepherd" },
      { property: "og:description", content: "Register a child in the church database." },
    ],
  }),
  component: AddChild,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function AddChild() {
  const { isChildrenLeader, isStaff } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [birthMonth, setBirthMonth] = useState<number | null>(null);
  const [birthDay, setBirthDay] = useState<number | null>(null);
  const [membershipYear, setMembershipYear] = useState(String(new Date().getFullYear()));
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isChildrenLeader && !isStaff) {
    return (
      <AppShell title="Add child" back="/children">
        <p className="text-sm text-muted-foreground">
          Only the children department leader can add child records.
        </p>
      </AppShell>
    );
  }

  async function uploadPhoto(file: File) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast.error("You must be signed in to upload a photo");
      return;
    }
    const path = `${uid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("member-photos").upload(path, file);
    if (error) {
      toast.error("Photo upload failed");
      return;
    }
    setPhotoPath(path);
    toast.success("Photo attached");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const createdBy = userData.user?.id;
    if (!createdBy) {
      setSaving(false);
      toast.error("You must be signed in to add a child");
      return;
    }

    const { data, error } = await supabase
      .from("members")
      .insert({
        full_name: fullName.trim(),
        gender: gender || null,
        birth_month: birthMonth,
        birth_day: birthDay,
        age_bracket: "0-12",
        marital_status: "Single",
        department: "Children",
        membership_year: membershipYear ? Number(membershipYear) : null,
        photo_url: photoPath,
        created_by: createdBy,
      })
      .select("id, full_name, member_code")
      .maybeSingle();

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Child added");
    await queryClient.invalidateQueries({ queryKey: ["members"] });
    if (data) {
      navigate({ to: "/members/$memberId", params: { memberId: data.id } });
    } else {
      navigate({ to: "/children" });
    }
  }

  return (
    <AppShell title="Add child" subtitle="Children department only" back="/children">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. David Okonkwo"
            required
          />
        </Field>

        <Field label="Photo">
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPhoto(f);
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gender">
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Membership year">
            <Input
              value={membershipYear}
              onChange={(e) => setMembershipYear(e.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field label="Birthday">
          <MonthDayPicker
            month={birthMonth}
            day={birthDay}
            onChange={(m, d) => {
              setBirthMonth(m);
              setBirthDay(d);
            }}
            placeholder="Pick birthday"
          />
        </Field>

        <p className="text-xs text-muted-foreground">
          This record will be saved in the Children department with the 0–12 age bracket.
        </p>

        <Button type="submit" className="w-full" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Add child"}
        </Button>
      </form>
    </AppShell>
  );
}
