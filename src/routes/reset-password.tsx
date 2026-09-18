import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

// Public page reached from the password-reset email link. The link carries a
// recovery token in the URL hash; once Supabase exchanges it for a session we
// let the user choose a brand-new password.
export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Shepherd" },
      { name: "description", content: "Choose a new password for your Shepherd account." },
      { property: "og:title", content: "Reset password — Shepherd" },
      { property: "og:description", content: "Choose a new password for your Shepherd account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  // True once a recovery session is detected; false while we wait for it.
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // Watch for the PASSWORD_RECOVERY event fired when the emailed link is
  // opened; also check the hash directly in case the event fired earlier.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback: some flows land with an existing session from the recovery link.
    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true);
        else setInvalid(true);
      });
    }, 1500);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    // Recovery sessions must NOT send current_password — they are exempt.
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated — you're signed in.");
    navigate({ to: "/home", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>

        {/* State: link invalid or expired */}
        {invalid && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Button className="mt-6 w-full" onClick={() => navigate({ to: "/auth", replace: true })}>
              Back to sign in
            </Button>
          </>
        )}

        {/* State: waiting for the recovery session to arrive */}
        {!invalid && !ready && (
          <p className="mt-4 text-sm text-muted-foreground">Verifying your reset link…</p>
        )}

        {/* State: ready to accept the new password */}
        {ready && (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                New password
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
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
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : "Update password"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="font-semibold text-primary underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
