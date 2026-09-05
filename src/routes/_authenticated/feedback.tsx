import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDate } from "@/lib/shepherd";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback — Shepherd" },
      { name: "description", content: "Share ideas and feedback to help your church community grow." },
      { property: "og:title", content: "Feedback — Shepherd" },
      { property: "og:description", content: "Send feedback to the church leadership." },
    ],
  }),
  component: Feedback,
});

type FeedbackRow = {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  user_id: string;
};

function Feedback() {
  const { auth, isPastor } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: ["feedback"],
    queryFn: async (): Promise<FeedbackRow[]> => {
      const { data, error } = await supabase
        .from("suggestions")
        .select("id, author_name, content, created_at, user_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FeedbackRow[];
    },
  });

  async function send() {
    const content = text.trim();
    if (!content) {
      toast.error("Please write your feedback first");
      return;
    }
    if (content.length > 2000) {
      toast.error("Please keep it under 2000 characters");
      return;
    }
    if (!auth) return;
    setBusy(true);
    const { error } = await supabase.from("suggestions").insert({
      user_id: auth.userId,
      author_name: auth.fullName || "",
      content,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    await queryClient.invalidateQueries({ queryKey: ["feedback"] });
    toast.success("Thank you — your feedback has been sent");
  }

  return (
    <AppShell title="Feedback" subtitle="Share your ideas" back="/home">
      <div className="rounded-2xl border border-border bg-card p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="What would make our church services or community better?"
        />
        <Button className="mt-3 w-full" onClick={() => void send()} disabled={busy}>
          {busy ? "Sending…" : "Send feedback"}
        </Button>
      </div>

      <h2 className="mb-2 mt-6 text-base font-semibold">
        {isPastor ? "All feedback" : "Your feedback"}
      </h2>
      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (listQuery.data ?? []).length === 0 ? (
        <EmptyState title="No feedback yet" hint="Your feedback will appear here." />
      ) : (
        <ul className="space-y-2">
          {(listQuery.data ?? []).map((s) => (
            <li key={s.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.author_name || "Member"}</span>
                <span className="text-xs text-muted-foreground">{formatDate(s.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{s.content}</p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
