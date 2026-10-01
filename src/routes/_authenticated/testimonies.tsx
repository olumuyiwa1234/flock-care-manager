import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDate } from "@/lib/shepherd";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/testimonies")({
  head: () => ({
    meta: [
      { title: "Testimonies — Shepherd" },
      { name: "description", content: "Share what God has done and read testimonies from your church family." },
      { property: "og:title", content: "Testimonies — Shepherd" },
      { property: "og:description", content: "Share and read church testimonies." },
    ],
  }),
  component: Testimonies,
});

type TestimonyRow = {
  id: string;
  user_id: string;
  author_name: string;
  title: string | null;
  content: string;
  created_at: string;
};

function Testimonies() {
  const { auth, isFullAccess } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  // All shared testimonies, newest first, plus each author's member id so
  // their name can link to their profile.
  const list = useQuery({
    queryKey: ["testimonies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("testimonies")
        .select("id, user_id, author_name, title, content, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as TestimonyRow[];
      // Map author user ids -> member ids for profile links.
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const memberOf = new Map<string, string>();
      if (ids.length) {
        const { data: ms } = await supabase.from("members").select("id, user_id").in("user_id", ids);
        for (const m of ms ?? []) if (m.user_id) memberOf.set(m.user_id, m.id);
      }
      return rows.map((r) => ({ ...r, memberId: memberOf.get(r.user_id) ?? null }));
    },
  });

  // Validate and save a new testimony from the signed-in user.
  async function share() {
    const content = text.trim();
    if (!content) return toast.error("Please write your testimony first");
    if (content.length > 4000) return toast.error("Please keep it under 4000 characters");
    if (!auth) return;
    setBusy(true);
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", auth.userId).maybeSingle();
    const { error } = await supabase.from("testimonies").insert({
      user_id: auth.userId,
      author_name: prof?.full_name || auth.email || "Member",
      title: title.trim().slice(0, 120) || null,
      content,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTitle("");
    setText("");
    toast.success("Testimony shared. Thank you!");
    queryClient.invalidateQueries({ queryKey: ["testimonies"] });
  }

  // Authors (or Pastor/Admin) can remove a testimony.
  async function remove(id: string) {
    if (!confirm("Delete this testimony?")) return;
    const { error } = await supabase.from("testimonies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Testimony deleted");
    queryClient.invalidateQueries({ queryKey: ["testimonies"] });
  }

  return (
    <AppShell title="Testimonies" subtitle="Share what God has done" back="/home">
      {/* Share form */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <Input placeholder="Title (optional)" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={5} placeholder="Write your testimony…" value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
        <Button className="w-full" onClick={() => void share()} disabled={busy}>
          {busy ? "Sharing…" : "Share testimony"}
        </Button>
      </div>

      {/* Everyone's testimonies */}
      <h2 className="mb-3 mt-6 text-base font-semibold">Testimonies from the church family</h2>
      {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!list.isLoading && (list.data ?? []).length === 0 && (
        <EmptyState title="No testimonies yet" hint="Be the first to share one." />
      )}
      <ul className="space-y-3">
        {(list.data ?? []).map((t) => (
          <li key={t.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {t.title && <p className="font-semibold">{t.title}</p>}
                <p className="text-xs text-muted-foreground">
                  {t.memberId ? (
                    <Link to="/members/$memberId" params={{ memberId: t.memberId }} className="hover:underline">
                      {t.author_name}
                    </Link>
                  ) : (
                    t.author_name
                  )}{" "}
                  · {formatDate(t.created_at)}
                </p>
              </div>
              {(t.user_id === auth?.userId || isFullAccess) && (
                <Button size="icon" variant="ghost" aria-label="Delete testimony" onClick={() => void remove(t.id)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{t.content}</p>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
