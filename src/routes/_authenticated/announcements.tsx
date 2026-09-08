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
};

function Announcements() {
  const { auth, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: ["announcements"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, author_name, is_active, created_at")
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
          hint="Only the Pastor and IT Infrastructure can send announcements."
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
    const { error } = await supabase.from("announcements").insert({
      title: title.trim(),
      body: text,
      author_name: auth.fullName || "Church leadership",
      created_by: auth.userId,
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
        <Button className="mt-3 w-full" onClick={() => void send()} disabled={busy}>
          {busy ? "Sending…" : "Send to everyone"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          This pops up for every user when they sign in, until they close it.
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
