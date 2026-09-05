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

export const Route = createFileRoute("/_authenticated/contact-pastor")({
  head: () => ({
    meta: [
      { title: "Contact Pastor — Shepherd" },
      { name: "description", content: "Send a private message or prayer request to your pastor." },
      { property: "og:title", content: "Contact Pastor — Shepherd" },
      { property: "og:description", content: "Leave a private message for the pastor." },
    ],
  }),
  component: ContactPastor,
});

type MessageRow = {
  id: string;
  author_name: string;
  subject: string | null;
  message: string;
  created_at: string;
  user_id: string;
};

function ContactPastor() {
  const { auth, isPastor } = useAuth();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const listQuery = useQuery({
    queryKey: ["pastor-messages"],
    queryFn: async (): Promise<MessageRow[]> => {
      const { data, error } = await supabase
        .from("pastor_messages")
        .select("id, author_name, subject, message, created_at, user_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
  });

  async function send() {
    const body = message.trim();
    if (!body) {
      toast.error("Please write your message first");
      return;
    }
    if (body.length > 2000) {
      toast.error("Please keep it under 2000 characters");
      return;
    }
    if (!auth) return;
    setBusy(true);
    const { error } = await supabase.from("pastor_messages").insert({
      user_id: auth.userId,
      author_name: auth.fullName || "",
      subject: subject.trim().slice(0, 120) || null,
      message: body,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubject("");
    setMessage("");
    await queryClient.invalidateQueries({ queryKey: ["pastor-messages"] });
    toast.success("Your message has been sent to the pastor");
  }

  return (
    <AppShell title="Contact Pastor" subtitle="Private message" back="/home">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          placeholder="Subject (optional)"
        />
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="Write your message or prayer request…"
        />
        <Button className="w-full" onClick={() => void send()} disabled={busy}>
          {busy ? "Sending…" : "Send to pastor"}
        </Button>
        <p className="text-xs text-muted-foreground">Only you and the pastor can read this.</p>
      </div>

      <h2 className="mb-2 mt-6 text-base font-semibold">
        {isPastor ? "Messages received" : "Your messages"}
      </h2>
      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (listQuery.data ?? []).length === 0 ? (
        <EmptyState title="No messages yet" hint="Messages you send appear here." />
      ) : (
        <ul className="space-y-2">
          {(listQuery.data ?? []).map((msg) => (
            <li key={msg.id} className="rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{msg.subject || msg.author_name || "Message"}</span>
                <span className="text-xs text-muted-foreground">{formatDate(msg.created_at)}</span>
              </div>
              {msg.subject && msg.author_name && (
                <p className="text-xs text-muted-foreground">From {msg.author_name}</p>
              )}
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{msg.message}</p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
