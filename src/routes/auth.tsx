import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { DEPARTMENTS } from "@/lib/shepherd";

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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("floor_member");
  const [department, setDepartment] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error(error.message);
      navigate({ to: "/home", replace: true });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          phone,
          role,
          department: role === "department_leader" ? department : null,
          access_code: accessCode.trim(),
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.session) {
      setSentEmail(true);
      return;
    }
    navigate({ to: "/home", replace: true });
  }

  async function google() {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return toast.error("Google sign-in failed");
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
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
              </div>
              <div className="space-y-1.5">
                <Label>Your role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="floor_member">Floor Member</SelectItem>
                    <SelectItem value="attendance_officer">Attendance Officer</SelectItem>
                    <SelectItem value="department_leader">Department Leader</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {role === "department_leader" && (
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Church access code (optional)</Label>
                <Input
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="e.g. HOPEHALL"
                  autoCapitalize="characters"
                />
                <p className="text-xs text-muted-foreground">
                  Leaders with the church code get full access to every feature.
                </p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>

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
