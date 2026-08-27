import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AGE_BRACKETS,
  DEPARTMENTS,
  GENDERS,
  MARITAL_STATUSES,
  MONTHS,
  bracketFromBirthYear,
} from "@/lib/shepherd";

export type MemberDraft = {
  full_name: string;
  phone: string;
  email: string;
  home_address: string;
  gender: string;
  birth_month: string;
  birth_year: string;
  age_bracket: string;
  anniversary_month: string;
  anniversary_day: string;
  marital_status: string;
  department: string;
  membership_year: string;
};

const empty: MemberDraft = {
  full_name: "",
  phone: "",
  email: "",
  home_address: "",
  gender: "",
  birth_month: "",
  birth_year: "",
  age_bracket: "",
  anniversary_month: "",
  anniversary_day: "",
  marital_status: "",
  department: "",
  membership_year: String(new Date().getFullYear()),
};

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

export function MemberForm({
  initial,
  memberId,
  isFirstTimer = false,
  invitedBy,
  submitLabel = "Save member",
  onSaved,
}: {
  initial?: Partial<MemberDraft> & { photo_url?: string | null };
  memberId?: string;
  isFirstTimer?: boolean;
  invitedBy?: string | null;
  submitLabel?: string;
  onSaved?: (member: { id: string; full_name: string; member_code: string }) => void;
}) {
  const [draft, setDraft] = useState<MemberDraft>({ ...empty, ...initial });
  const [photoPath, setPhotoPath] = useState<string | null>(initial?.photo_url ?? null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof MemberDraft, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  async function uploadPhoto(file: File) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
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
    if (!draft.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      full_name: draft.full_name.trim(),
      phone: draft.phone || null,
      email: draft.email || null,
      home_address: draft.home_address || null,
      gender: draft.gender || null,
      birth_month: draft.birth_month ? Number(draft.birth_month) : null,
      birth_year: draft.birth_year ? Number(draft.birth_year) : null,
      age_bracket: draft.age_bracket || bracketFromBirthYear(Number(draft.birth_year)) || null,
      anniversary_month: draft.anniversary_month ? Number(draft.anniversary_month) : null,
      anniversary_day: draft.anniversary_day ? Number(draft.anniversary_day) : null,
      marital_status: draft.marital_status || null,
      department: draft.department || null,
      membership_year: draft.membership_year ? Number(draft.membership_year) : null,
      photo_url: photoPath,
    };

    const query = memberId
      ? supabase.from("members").update(payload).eq("id", memberId)
      : supabase.from("members").insert({
          ...payload,
          is_first_timer: isFirstTimer,
          invited_by: invitedBy ?? null,
          created_by: userData.user?.id ?? null,
        });

    const { data, error } = await query.select("id, full_name, member_code").maybeSingle();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(memberId ? "Member updated" : "Member added");
    if (data) onSaved?.(data);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name">
        <Input
          value={draft.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          placeholder="e.g. Grace Adeyemi"
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
        <Field label="Phone number">
          <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Email">
          <Input
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
            inputMode="email"
          />
        </Field>
      </div>

      <Field label="Home address">
        <Textarea
          value={draft.home_address}
          onChange={(e) => set("home_address", e.target.value)}
          rows={2}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Gender">
          <Select value={draft.gender} onValueChange={(v) => set("gender", v)}>
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
        <Field label="Marital status">
          <Select value={draft.marital_status} onValueChange={(v) => set("marital_status", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_STATUSES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Birth month">
          <Select value={draft.birth_month} onValueChange={(v) => set("birth_month", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Birth year">
          <Input
            value={draft.birth_year}
            onChange={(e) => set("birth_year", e.target.value)}
            inputMode="numeric"
            placeholder="1990"
          />
        </Field>
      </div>

      <Field label="Age bracket">
        <Select value={draft.age_bracket} onValueChange={(v) => set("age_bracket", v)}>
          <SelectTrigger>
            <SelectValue placeholder="Auto from birth year" />
          </SelectTrigger>
          <SelectContent>
            {AGE_BRACKETS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Anniversary month">
          <Select value={draft.anniversary_month} onValueChange={(v) => set("anniversary_month", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Anniversary day">
          <Input
            value={draft.anniversary_day}
            onChange={(e) => set("anniversary_day", e.target.value)}
            inputMode="numeric"
            placeholder="14"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Department (optional)">
          <Select value={draft.department} onValueChange={(v) => set("department", v)}>
            <SelectTrigger>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Membership year">
          <Input
            value={draft.membership_year}
            onChange={(e) => set("membership_year", e.target.value)}
            inputMode="numeric"
          />
        </Field>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={saving}>
        {saving ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
