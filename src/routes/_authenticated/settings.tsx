import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/shepherd";
import { useChurchSettings } from "@/lib/queries";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Shepherd" },
      { name: "description", content: "Set your church location, check-in radius and review your account role." },
      { property: "og:title", content: "Settings — Shepherd" },
      { property: "og:description", content: "Configure church premises and check-in rules." },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { auth, isFloor, hasFullAccess } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: settings } = useChurchSettings();

  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("300");
  const [geofence, setGeofence] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setName(settings.church_name ?? "");
    setLat(settings.latitude != null ? String(settings.latitude) : "");
    setLng(settings.longitude != null ? String(settings.longitude) : "");
    setRadius(String(settings.radius_meters ?? 300));
    setGeofence(!!settings.geofence_enabled);
  }, [settings]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("church_settings")
      .update({
        church_name: name,
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        radius_meters: Number(radius) || 300,
        geofence_enabled: geofence,
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["church-settings"] });
    toast.success("Settings saved");
  }

  function useMyLocation() {
    if (!navigator.geolocation) return toast.error("Location not available");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(String(p.coords.latitude));
        setLng(String(p.coords.longitude));
        toast.success("Using your current location");
      },
      () => toast.error("Could not read your location"),
    );
  }

  return (
    <AppShell title="Settings" subtitle={auth?.email ?? ""}>
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="font-medium">{auth?.email}</p>
        <p className="mt-1 text-sm text-primary">
          {auth?.role ? ROLE_LABELS[auth.role] : "Member"}
        </p>
      </div>

      {isFloor || !hasFullAccess ? (
        <div className="mt-4">
          <EmptyState
            title="Church setup is managed by leaders"
            hint="Ask a senior pastor or attendance officer to change premises settings."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-4">
          <div>
            <Label>Church name</Label>
            <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-3">
            <div>
              <p className="text-sm font-medium">Require presence on premises</p>
              <p className="text-xs text-muted-foreground">Check-in only works inside the radius.</p>
            </div>
            <Switch checked={geofence} onCheckedChange={setGeofence} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude</Label>
              <Input className="mt-1" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input className="mt-1" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={useMyLocation}>
            <MapPin className="mr-2 size-4" /> Use my current location
          </Button>
          <div>
            <Label>Check-in radius (metres)</Label>
            <Input
              className="mt-1"
              inputMode="numeric"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      )}

      <Button variant="ghost" className="mt-6 w-full text-destructive" onClick={() => void signOut()}>
        <LogOut className="mr-2 size-4" /> Sign out
      </Button>
    </AppShell>
  );
}
