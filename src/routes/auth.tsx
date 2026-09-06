import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { MonthDayPicker } from "@/components/MonthDayPicker";
import { MultiSelect } from "@/components/MultiSelect";
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
  ROLE_LABELS,
  SUB_ROLES,
  type AppRole,
} from "@/lib/shepherd";
import { savePendingMember, flushPendingMember, clearPendingMember } from "@/lib/pendingMember";
import { pastorSeatTaken } from "@/lib/pastor.functions";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Shepherd" },
      {
        name: "description",
        content: "Sign in or register for Shepherd to check in members and manage church attendance.",
      },
      { property: "og:title", content: "Sign in — Shepherd" },
      { property: "og:description", content: "Sign in or register to manage your church records." },
    ],
  }),
  component: AuthPage,
});

const ROLE_OPTIONS: AppRole[] = [
  "member",
  "pastorate",
  "hod",
  "group_leader",
  "it_infrastructure",
  "follow_up",
];

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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

  // profile / member details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [bracket, setBracket] = useState("");
  const [annivMonth, setAnnivMonth] = useState("");
  const [annivDay, setAnnivDay] = useState("");
  const [marital, setMarital] = useState("");
  const [status, setStatus] = useState<"Member" | "Worker">("Member");
  const [departments, setDepartments] = useState<string[]>([]);
  const [membershipYear, setMembershipYear] = useState(String(new Date().getFullYear()));
  const [roles, setRoles] = useState<AppRole[]>(["member"]);
  const [subRoles, setSubRoles] = useState<Record<string, string[]>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const isWorker = status === "Worker";
  const effectiveRoles: AppRole[] = isWorker ? roles : ["member"];
  const effectiveSubRoles = isWorker ? subRoles : {};
  const effectiveDepartments = isWorker ? departments : [];

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  const [pastorTaken, setPastorTaken] = useState(false);
  useEffect(() => {
    void pastorSeatTaken()
      .then((r) => setPastorTaken(r.taken))
      .catch(() => setPastorTaken(false));
  }, []);

  function optionsFor(r: AppRole) {
    return (SUB_ROLES[r] as readonly string[]).filter(
      (s) => !(r === "pastorate" && s === "Pastor" && pastorTaken),
    );
  }

  const allSubRoles = effectiveRoles.flatMap((r) => effectiveSubRoles[r] ?? []);
  const isPastor = (effectiveSubRoles["pastorate"] ?? []).includes("Pastor");
  const needsApproval = !(effectiveRoles.every((r) => r === "member") || isPastor);


  async function uploadPhoto(userId: string) {
    if (!photoFile) return;
    const ext = photoFile.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("member-photos").upload(path, photoFile);
    if (error) return;
    await supabase.from("members").update({ photo_url: path }).eq("user_id", userId);
  }

  async function afterSession(userId: string) {
    await flushPendingMember(userId);
    await uploadPhoto(userId);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    if (mode === "signin") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
      if (data.user) await afterSession(data.user.id);
      setBusy(false);
      navigate({ to: "/home", replace: true });
      return;
    }

    if (effectiveRoles.length === 0) {
      setBusy(false);
      toast.error("Please select at least one role");
      return;
    }

    const missing = effectiveRoles.find(
      (r) => optionsFor(r).length > 0 && (effectiveSubRoles[r] ?? []).length === 0,
    );
    if (missing) {
      setBusy(false);
      toast.error(`Please select your ${missing === "hod" ? "department lead" : "sub-role"}`);
      return;
    }

    const departmentValue = effectiveRoles.includes("hod")
      ? Array.from(new Set([...(effectiveSubRoles["hod"] ?? []), ...effectiveDepartments])).join(", ")
      : effectiveDepartments.join(", ");

    savePendingMember({
      full_name: fullName.trim(),
      photo_url: null,
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
      department: departmentValue || null,
      membership_year: membershipYear ? Number(membershipYear) : null,
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName.trim(),
          phone,
          role: effectiveRoles.find((r) => r !== "member") ?? "member",
          roles: effectiveRoles,
          sub_role: allSubRoles.length > 0 ? allSubRoles.join(", ") : null,
          department: departmentValue || null,
        },
      },
    });
    if (error) {
      setBusy(false);
      clearPendingMember();
      const msg = /already|registered|exists/i.test(error.message)
        ? "This email address already has an account. Please sign in instead."
        : error.message;
      toast.error(msg);
      if (/already|registered|exists/i.test(error.message)) setMode("signin");
      return;
    }
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setBusy(false);
      clearPendingMember();
      toast.error("This email address already has an account. Please sign in instead.");
      setMode("signin");
      return;
    }
    if (!data.session) {
      setBusy(false);
      setSentEmail(true);
      return;
    }
    if (data.user) await afterSession(data.user.id);
    setBusy(false);
    if (needsApproval) {
      toast.success("Account created. A pastor will review your access request.");
    }
    navigate({ to: "/home", replace: true });
  }

  async function google() {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home", replace: true });
  }

  if (sentEmail) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to {email}. Confirm it, then sign in to Shepherd.
          </p>
          <Button className="mt-6 w-full" onClick={() => { setSentEmail(false); setMode("signin"); }}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-sky-gradient px-6 pb-10 pt-12 text-primary-foreground">
        <div className="mx-auto max-w-xl">
          <Link to="/" className="text-sm font-medium uppercase tracking-[0.3em] opacity-70">
            Shepherd
          </Link>
          <h1 className="mt-4 text-3xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm opacity-85">
            {mode === "signin"
              ? "Sign in to continue caring for your congregation."
              : "Register to join your church on Shepherd."}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-6 py-8">
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <>
              <Field label="Full name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </Field>

              <Field label="Photo">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </Field>

              <Field label="Phone number">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
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
                      {MARITAL_STATUSES.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Birthday">
                <MonthDayPicker
                  month={birthMonth ? Number(birthMonth) : null}
                  day={birthDay ? Number(birthDay) : null}
                  onChange={(m, d) => { setBirthMonth(m ? String(m) : ""); setBirthDay(d ? String(d) : ""); }}
                  placeholder="Pick your birthday"
                />
              </Field>

              <Field label="Age bracket">
                <Select value={bracket} onValueChange={setBracket}>
                  <SelectTrigger><SelectValue placeholder="Select age bracket" /></SelectTrigger>
                  <SelectContent>
                    {AGE_BRACKETS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Wedding anniversary (optional)">
                <MonthDayPicker
                  month={annivMonth ? Number(annivMonth) : null}
                  day={annivDay ? Number(annivDay) : null}
                  onChange={(m, d) => { setAnnivMonth(m ? String(m) : ""); setAnnivDay(d ? String(d) : ""); }}
                  placeholder="Pick anniversary"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Departments (optional)">
                  <MultiSelect
                    options={DEPARTMENTS}
                    value={departments}
                    onChange={setDepartments}
                    placeholder="None"
                  />
                </Field>
                <Field label="Membership year">
                  <Input
                    value={membershipYear}
                    onChange={(e) => setMembershipYear(e.target.value)}
                    inputMode="numeric"
                  />
                </Field>
              </div>

              <Field label="Your roles">
                <MultiSelect
                  options={ROLE_OPTIONS.map((r) => ROLE_LABELS[r])}
                  value={roles.map((r) => ROLE_LABELS[r])}
                  onChange={(labels) => {
                    const next = ROLE_OPTIONS.filter((r) => labels.includes(ROLE_LABELS[r]));
                    setRoles(next);
                    setSubRoles((prev) => {
                      const kept: Record<string, string[]> = {};
                      next.forEach((r) => {
                        if (prev[r]) kept[r] = prev[r];
                      });
                      return kept;
                    });
                  }}
                  placeholder="Select roles"
                />
              </Field>

              {roles
                .filter((r) => optionsFor(r).length > 0)
                .map((r) => (
                  <Field
                    key={r}
                    label={r === "hod" ? "Department Lead" : `${ROLE_LABELS[r]} sub-role`}
                  >
                    <MultiSelect
                      options={optionsFor(r)}
                      value={subRoles[r] ?? []}
                      onChange={(v) => setSubRoles((prev) => ({ ...prev, [r]: v }))}
                      placeholder="Select"
                    />
                  </Field>
                ))}

              {needsApproval && (
                <p className="text-xs text-muted-foreground">
                  Leadership accounts need a pastor's approval before full access is granted.
                </p>
              )}
            </>
          )}

          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Password">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" size="lg" className="w-full" onClick={google}>
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to Shepherd?" : "Already registered?"}{" "}
          <button
            type="button"
            className="font-semibold text-primary underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
