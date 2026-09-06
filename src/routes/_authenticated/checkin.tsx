import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { MemberForm } from "@/components/MemberForm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { todaysService, todayISO } from "@/lib/shepherd";
import { useMembers } from "@/lib/queries";
import { checkGeofence, type GeofenceResult } from "@/lib/geofence.functions";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/checkin")({
  head: () => ({
    meta: [
      { title: "Check In — Shepherd" },
      { name: "description", content: "Tap to check in at the church premises and record attendance instantly." },
      { property: "og:title", content: "Check In — Shepherd" },
      { property: "og:description", content: "One-tap attendance check-in for church members." },
    ],
  }),
  component: CheckIn,
});

type Step = "idle" | "ask-invite" | "invitee" | "done";

function CheckIn() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const { data: members = [] } = useMembers();

  const [geo, setGeo] = useState<GeofenceResult | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const todayService = useMemo(() => todaysService(), []);
  const serviceType = todayService ?? "";
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);

  const ownMember = useMemo(
    () => members.find((m) => m.user_id === auth?.userId) ?? null,
    [members, auth?.userId],
  );

  useEffect(() => {
    if (!ownMember || !todayService) return;
    let cancelled = false;
    supabase
      .from("attendance")
      .select("id")
      .eq("member_id", ownMember.id)
      .eq("service_date", todayISO())
      .eq("service_type", todayService)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setCheckedIn(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ownMember, todayService]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
        });
        if (cancelled) return;
        const result = await checkGeofence({
          data: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
          },
        });
        if (cancelled) return;
        setGeo(result);
        setLocating(false);
      } catch {
        if (cancelled) return;
        setGeoError("Location permission denied or unavailable.");
        setLocating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);


  const geofenceOn = geo?.enabled ?? true;
  const withinPremises = geo?.allowed ?? false;

  async function saveAttendance(memberId: string) {
    if (!todayService) {
      toast.error("No service is scheduled today — check-in is closed.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("attendance").upsert(
      {
        member_id: memberId,
        service_date: todayISO(),
        service_type: serviceType,
        status: "Present",
        check_in_time: new Date().toISOString(),
        recorded_by: auth?.userId ?? null,
      },
      { onConflict: "member_id,service_date,service_type" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    if (memberId === ownMember?.id) setCheckedIn(true);
    setStep("done");
    toast.success("Attendance saved");
  }

  async function ensureOwnMember(): Promise<string | null> {
    if (!auth?.userId) {
      toast.error("You must be signed in to check in");
      return null;
    }
    if (ownMember) return ownMember.id;

    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("members")
      .insert({
        full_name: auth.fullName || "Member",
        email: auth.email,
        user_id: auth.userId,
        created_by: auth.userId,
        department: auth.department,
        membership_year: new Date().getFullYear(),
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    await queryClient.invalidateQueries({ queryKey: ["members"] });
    return data.id;
  }

  async function startCheckIn() {
    if (checkedIn) {
      toast.info("You've already checked in for today's service.");
      return;
    }
    setSaving(true);
    const memberId = await ensureOwnMember();
    setSaving(false);
    if (!memberId) return;
    setSelectedMember(memberId);
    setStep("ask-invite");
  }

  return (
    <AppShell title="Check In" subtitle={geo?.churchName ?? "Church"}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Today's service
          </Label>
          {todayService ? (
            <p className="mt-2 text-base font-semibold text-foreground">{todayService}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No service is scheduled today. Check-in opens on Sundays (Sunday Service),
              Tuesdays (Digging Deep) and Thursdays (Faith Clinic).
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 pt-2">
          <button
            type="button"
            disabled={!todayService || !withinPremises || locating || saving || checkedIn}
            onClick={startCheckIn}
            className={`grid size-52 place-items-center rounded-full text-primary-foreground transition ${
              todayService && withinPremises && !locating && !checkedIn
                ? "bg-sky-gradient shadow-float animate-pulse-ring active:scale-95"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            }`}
          >
            <span className="flex flex-col items-center gap-2">
              {locating ? (
                <Loader2 className="size-10 animate-spin" />
              ) : (
                <Check className="size-14" strokeWidth={2.5} />
              )}
              <span className="text-lg font-semibold">
                {checkedIn
                  ? "Checked in"
                  : !todayService
                    ? "No service today"
                    : locating
                      ? "Locating…"
                      : withinPremises
                        ? "Check In"
                        : "Out of range"}
              </span>
            </span>
          </button>

          <p className="flex items-center gap-2 text-center text-sm text-muted-foreground">
            <MapPin className="size-4" />
            {!geofenceOn
              ? "Location check is off — check-in is open."
              : geoError
                ? geoError
                : geo
                  ? withinPremises
                    ? `You are within ${geo.churchName} premises`
                    : `You are outside ${geo.churchName} premises`
                  : "Checking your location…"}
          </p>
        </div>
      </div>

      <Dialog open={step === "ask-invite"} onOpenChange={(o) => !o && setStep("idle")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Did you invite someone today?</DialogTitle>
            <DialogDescription>
              If yes, create a profile for your guest before we save your attendance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setStep("invitee")}>
              Yes, add guest
            </Button>
            <Button onClick={() => void saveAttendance(selectedMember)} disabled={saving}>
              No, check me in
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "invitee"} onOpenChange={(o) => !o && setStep("idle")}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Guest profile</DialogTitle>
            <DialogDescription>
              We'll record them as a first-time visitor invited by you.
            </DialogDescription>
          </DialogHeader>
          <MemberForm
            isFirstTimer
            invitedBy={selectedMember}
            submitLabel="Save guest & check in"
            onSaved={async (guest) => {
              await supabase.from("attendance").upsert(
                {
                  member_id: guest.id,
                  service_date: todayISO(),
                  service_type: serviceType,
                  status: "Present",
                  recorded_by: auth?.userId ?? null,
                },
                { onConflict: "member_id,service_date,service_type" },
              );
              await queryClient.invalidateQueries({ queryKey: ["members"] });
              await saveAttendance(selectedMember);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={step === "done"} onOpenChange={(o) => !o && setStep("idle")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>You're checked in</DialogTitle>
            <DialogDescription>
              Attendance was saved automatically for {serviceType.toLowerCase()} today.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setStep("idle")}>Done</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
