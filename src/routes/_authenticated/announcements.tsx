import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDate } from "@/lib/shepherd";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcement — Shepherd" },
      { name: "description", content: "Send a church-wide announcement to every Shepherd user." },
      { property: "og:title", content: "Announcement — Shepherd" },
      { property: "og:description", content: "Blast a message to the whole church." },
    ],
  }),
  component: Announcements,
});

type Row = {
  id: string;
  title: string;
  body: string;
  author_name: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

/** How long a blast keeps popping up, in hours
 *  (0 = until it is stopped manually, -1 = the sender types a custom end time). */
const DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "Custom time…", hours: -1 },
  { label: "Until I stop it", hours: 0 },
];

/** Format a Date as the local `YYYY-MM-DDTHH:mm` value a datetime-local input expects. */
function localDateTimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Announcements() {
  const { auth, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hours, setHours] = useState(24);
  // Exact end date/time typed by the sender when "Custom time…" is picked.
  const [customUntil, setCustomUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: ["announcements"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, author_name, is_active, created_at, expires_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (!isAdmin) {
    return (
      <AppShell title="Announcement" back="/home">
        <EmptyState
          title="Not available"
          hint="Only the Pastor and Admin can send announcements."
        />
      </AppShell>
    );
  }

  async function send() {
    const text = body.trim();
    if (!text) {
      toast.error("Please write the announcement first");
      return;
    }
    if (!auth) return;
    setBusy(true);
    // Work out when the blast should stop popping up.
    let expiresAt: string | null = null;
    if (hours > 0) {
      // Preset duration: count the chosen number of hours from right now.
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    } else if (hours === -1) {
      // Custom time: the sender typed the exact date and time the blast should stop.
      if (!customUntil) {
        setBusy(false);
        toast.error("Pick the date and time the blast should stop");
        return;
      }
      const end = new Date(customUntil);
      if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) {
        setBusy(false);
        toast.error("The custom end time must be in the future");
        return;
      }
      expiresAt = end.toISOString();
    }
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: text,
      author_name: auth.fullName || "Church leadership",
      created_by: auth.userId,
      expires_at: expiresAt,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setBody("");
    await queryClient.invalidateQueries({ queryKey: ["announcements"] });
    await queryClient.invalidateQueries({ queryKey: ["active-announcement"] });
    toast.success("Announcement sent to everyone");
  }


  async function toggle(row: Row) {
    const { error } = await supabase
      .from("announcements")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["announcements"] });
    await queryClient.invalidateQueries({ queryKey: ["active-announcement"] });
  }

  async function remove(row: Row) {
    const { error } = await supabase.from("announcements").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["announcements"] });
    await queryClient.invalidateQueries({ queryKey: ["active-announcement"] });
    toast.success("Announcement removed");
  }

  const rows = listQuery.data ?? [];

  return (
    <AppShell title="Announcement" subtitle="Blast a message to everyone" back="/home">
      <div className="rounded-2xl border border-border bg-card p-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Title (optional)"
        />
        <Textarea
          className="mt-3"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={1000}
          placeholder="What should everyone know?"
        />
        {/* Sender chooses how long the blast should keep popping up. */}
        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          Keep showing for
        </label>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {DURATIONS.map((d) => (
            <option key={d.hours} value={d.hours}>
              {d.label}
            </option>
          ))}
        </select>
        {/* With "Custom time…" picked, the sender types the exact date and time the blast stops. */}
        {hours === -1 && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-muted-foreground">
              Show until
            </label>
            <input
              type="datetime-local"
              value={customUntil}
              onChange={(e) => setCustomUntil(e.target.value)}
              min={localDateTimeValue(new Date())}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
        )}
        <Button className="mt-3 w-full" onClick={() => void send()} disabled={busy}>
          {busy ? "Sending…" : "Send to everyone"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          It pops up for everyone during that time. Closing it hides it until the person opens or
          signs into the app again.
        </p>

      </div>

      <h2 className="mb-2 mt-6 text-base font-semibold">Sent announcements</h2>
      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No announcements yet" hint="Your blasts will be listed here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.title || "Church announcement"}</span>
                <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.body}</p>
              {/* Show when this blast stops popping up. */}
              <p className="mt-1 text-xs text-muted-foreground">
                {r.expires_at
                  ? new Date(r.expires_at).getTime() > Date.now()
                    ? `Showing until ${formatDate(r.expires_at)}`
                    : "No longer showing"
                  : "Shows until you stop it"}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void toggle(r)}>
                  {r.is_active ? "Stop showing" : "Show again"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(r)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
