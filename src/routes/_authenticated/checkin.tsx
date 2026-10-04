import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const locateMember = useCallback(async () => {
    setLocating(true);
    setGeoError(null);

    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      let latestResult: GeofenceResult | null = null;
      let receivedPosition = false;

      // A phone's GPS readings jump around, especially indoors. Collect every
      // reading over a short window and send them all to the server, which
      // lets the member in as soon as ANY trustworthy reading (or the average
      // of them) places them inside the church.
      type Fix = { lat: number; lng: number; accuracy?: number | undefined };
      const fixes: Fix[] = [];
      const pushFix = (lat: number, lng: number, accuracy: number | null | undefined) => {
        fixes.push({
          lat,
          lng,
          accuracy: accuracy != null && Number.isFinite(accuracy) ? Math.min(accuracy, 5000) : undefined,
        });
        // Keep only the most recent 40 readings.
        if (fixes.length > 40) fixes.shift();
      };

      // --- Start watching the live position --------------------------------
      let watchId: string | undefined;
      try {
        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
          (pos) => {
            if (!pos?.coords) return;
            pushFix(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          },
        );
      } catch {
        // Watching failed (e.g. permission prompt dismissed); a single
        // snapshot below is the fallback.
      }

      // Ask the server to judge every reading collected so far.
      const judge = async (): Promise<GeofenceResult | null> => {
        if (fixes.length === 0) return null;
        try {
          return await checkGeofence({ data: { fixes: [...fixes] } });
        } catch {
          return null; // Network hiccup — caller keeps trying.
        }
      };

      // --- Refine for up to 30 seconds, checking every 1.5 seconds ---------
      // Stop early when the member is confirmed inside (fast check-in) or
      // confirmed clearly outside.
      if (watchId) {
        const deadline = Date.now() + 30000;
        let lastCount = 0;
        while (Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          if (fixes.length === lastCount) continue; // nothing new to judge
          lastCount = fixes.length;
          const r = await judge();
          if (r) {
            latestResult = r;
            receivedPosition = true;
            if (r.allowed || !r.enabled || !r.weakSignal) break;
          }
        }
      }

      // --- Fallback: one-off snapshot when the watch produced nothing ------
      if (fixes.length === 0) {
        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
          pushFix(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        } catch {
          // No usable position at all.
        }
      }

      // Final verdict using everything collected (if not already decided).
      if (fixes.length > 0 && (!latestResult || latestResult.weakSignal)) {
        const r = await judge();
        if (r) latestResult = r;
        receivedPosition = true;
      }

      // Stop watching so the GPS radio does not keep draining battery.
      if (watchId) {
        try {
          await Geolocation.clearWatch({ id: watchId });
        } catch {
          // Clearing the watch is best-effort.
        }
      }

      if (!receivedPosition || !latestResult) {
        setGeoError("Location permission denied or unavailable.");
        setGeo(null);
        return;
      }
      // A GPS reading too rough to trust: ask the member to try again
      // (outdoors / with location on high accuracy) instead of guessing.
      if (latestResult.weakSignal) {
        setGeoError(
          "Your phone's location is not precise enough right now. Turn on high-accuracy location, step near a window or outside, then tap \"Check location again\".",
        );
      }
      setGeo(latestResult);
    } catch {
      setGeoError("Location permission denied or unavailable.");
      setGeo(null);
    } finally {
      setLocating(false);
    }
  }, []);

  const hasCheckedIn = useCallback(
    async (memberId: string) => {
      if (!todayService) return false;
      const { data } = await supabase
        .from("attendance")
        .select("id")
        .eq("member_id", memberId)
        .eq("service_date", todayISO())
        .eq("service_type", todayService)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
    [todayService],
  );

  useEffect(() => {
    if (!auth?.userId || !todayService) return;
    let cancelled = false;
    void (async () => {
      let memberId = ownMember?.id ?? null;
      if (!memberId) {
        const { data } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", auth.userId)
          .maybeSingle();
        memberId = data?.id ?? null;
      }
      if (!memberId || cancelled) return;
      const already = await hasCheckedIn(memberId);
      if (!cancelled && already) setCheckedIn(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ownMember, todayService, auth?.userId, hasCheckedIn]);

  useEffect(() => {
    let cancelled = false;
    void locateMember().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [locateMember]);


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
    setCheckedIn(true);
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
    if (!memberId) {
      setSaving(false);
      return;
    }
    const already = await hasCheckedIn(memberId);
    setSaving(false);
    if (already) {
      setCheckedIn(true);
      toast.info("You've already checked in for today's service.");
      return;
    }
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
                        : geo?.weakSignal
                          ? "Weak signal"
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
          {!locating && geofenceOn && !withinPremises ? (
            <Button variant="outline" onClick={() => void locateMember()}>
              <MapPin className="mr-2 size-4" /> Check location again
            </Button>
          ) : null}
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
