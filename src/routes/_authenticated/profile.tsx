import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MemberPhoto } from "@/components/MemberPhoto";
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
  ROLE_LABELS,
} from "@/lib/shepherd";
import { useAuth } from "@/lib/useAuth";
import { authQueryKey } from "@/lib/useAuth";
import type { MemberRow } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Shepherd" },
      { name: "description", content: "View and update your own contact details, photo and church information." },
      { property: "og:title", content: "My profile — Shepherd" },
      { property: "og:description", content: "Keep your personal church profile up to date." },
    ],
  }),
  component: MyProfile,
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

function MyProfile() {
  const { auth, role } = useAuth();
  const queryClient = useQueryClient();
  const userId = auth?.userId;

  const memberQuery = useQuery({
    queryKey: ["my-member", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as MemberRow | null;
    },
  });

  const m = memberQuery.data;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [bracket, setBracket] = useState("");
  const [annivMonth, setAnnivMonth] = useState("");
  const [annivDay, setAnnivDay] = useState("");
  const [marital, setMarital] = useState("");
  const [department, setDepartment] = useState("");
  const [membershipYear, setMembershipYear] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!m) return;
    setFullName(m.full_name ?? "");
    setPhone(m.phone ?? "");
    setEmail(m.email ?? "");
    setAddress(m.home_address ?? "");
    setGender(m.gender ?? "");
    setBirthMonth(m.birth_month ? String(m.birth_month) : "");
    setBirthDay(m.birth_day ? String(m.birth_day) : "");
    setBracket(m.age_bracket ?? "");
    setAnnivMonth(m.anniversary_month ? String(m.anniversary_month) : "");
    setAnnivDay(m.anniversary_day ? String(m.anniversary_day) : "");
    setMarital(m.marital_status ?? "");
    setDepartment(m.department ?? "");
    setMembershipYear(m.membership_year ? String(m.membership_year) : "");
  }, [m]);

  async function uploadPhoto(file: File) {
    if (!userId) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("member-photos").upload(path, file);
    if (error) {
      toast.error("Could not upload the photo");
      return;
    }
    await supabase.from("members").update({ photo_url: path }).eq("user_id", userId);
    await queryClient.invalidateQueries({ queryKey: ["my-member", userId] });
    toast.success("Photo updated");
  }

  async function save() {
    if (!userId) return;
    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("members")
      .update({
        full_name: fullName.trim(),
        phone: phone || null,
        email: email || null,
        home_address: address || null,
        gender: gender || null,
        birth_month: birthMonth ? Number(birthMonth) : null,
        birth_day: birthDay ? Number(birthDay) : null,
        age_bracket: bracket || null,
        anniversary_month: annivMonth ? Number(annivMonth) : null,
        anniversary_day: annivDay ? Number(annivDay) : null,
        marital_status: marital || null,
        department: department || null,
        membership_year: membershipYear ? Number(membershipYear) : null,
      })
      .eq("user_id", userId);

    if (!error) {
      await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), phone: phone || null })
        .eq("id", userId);
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["my-member", userId] });
    await queryClient.invalidateQueries({ queryKey: authQueryKey });
    toast.success("Profile updated");
  }

  return (
    <AppShell title="My profile" subtitle={ROLE_LABELS[role]} back="/home">
      {memberQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !m ? (
        <p className="text-sm text-muted-foreground">
          Your member record is being set up. Check in once and it will appear here.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <MemberPhoto path={m.photo_url} name={m.full_name} size={72} />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{m.member_code}</p>
              <label className="mt-2 inline-block cursor-pointer text-sm font-medium text-primary">
                Change photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPhoto(f);
                  }}
                />
              </label>
            </div>
          </div>

          <Field label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Phone number">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Email address">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </Field>
          <Field label="Home address">
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender">
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Marital status">
              <Select value={marital} onValueChange={setMarital}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Birth month">
              <Select value={birthMonth} onValueChange={setBirthMonth}>
                <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((mo, i) => (
                    <SelectItem key={mo} value={String(i + 1)}>{mo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Birth day">
              <Input value={birthDay} onChange={(e) => setBirthDay(e.target.value)} inputMode="numeric" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Anniversary month">
              <Select value={annivMonth} onValueChange={setAnnivMonth}>
                <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((mo, i) => (
                    <SelectItem key={mo} value={String(i + 1)}>{mo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Anniversary day">
              <Input value={annivDay} onChange={(e) => setAnnivDay(e.target.value)} inputMode="numeric" />
            </Field>
          </div>

          <Field label="Age bracket">
            <Select value={bracket} onValueChange={setBracket}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {AGE_BRACKETS.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
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

          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </AppShell>
  );
}
