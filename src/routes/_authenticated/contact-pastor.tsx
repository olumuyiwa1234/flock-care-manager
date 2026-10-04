import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";

// Route definition with page metadata.
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

// Contact Pastor page: a send-only form. Sent messages are delivered to the
// Pastor Inbox and are intentionally NOT listed on this page.
function ContactPastor() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  // Form state for the subject, message body and sending indicator.
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Validate and send the message to the pastor's inbox.
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
    // Clear the form and refresh the pastor's inbox data.
    setSubject("");
    setMessage("");
    await queryClient.invalidateQueries({ queryKey: ["pastor-inbox"] });
    toast.success("Your message has been sent to the pastor");
  }

  // Render the send form only.
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
        <p className="text-xs text-muted-foreground">
          Your message goes straight to the pastor's inbox and is not shown here.
        </p>
      </div>
    </AppShell>
  );
}
