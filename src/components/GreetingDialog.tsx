import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { celebrantPhone, sendGreeting } from "@/lib/greetings.functions";

type Props = {
  memberId: string;
  name: string;
  occasion: "birthday" | "anniversary";
};

function defaultMessage(name: string, occasion: Props["occasion"]) {
  const first = name.split(" ")[0] || name;
  return occasion === "birthday"
    ? `Happy birthday, ${first}! Wishing you a joyful year ahead. God bless you.`
    : `Happy wedding anniversary, ${first}! Wishing you and your family many more blessed years together.`;
}

export function GreetingDialog({ memberId, name, occasion }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(() => defaultMessage(name, occasion));
  const [sending, setSending] = useState(false);

  const phoneQuery = useQuery({
    queryKey: ["celebrant-phone", memberId],
    enabled: open,
    staleTime: 10 * 60_000,
    queryFn: () => celebrantPhone({ data: { memberId } }),
  });
  const phone = phoneQuery.data?.phone ?? null;

  async function send() {
    setSending(true);
    try {
      await sendGreeting({ data: { memberId, occasion, message } });
      toast.success(`Your message was sent to ${name}.`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  function openWhatsApp() {
    if (!phone) return;
    const digits = phone.replace(/[^\d]/g, "");
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="shrink-0">
          <Send className="mr-1 size-4" /> Send message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message {name}</DialogTitle>
          <DialogDescription>
            {occasion === "birthday"
              ? "Send a birthday greeting."
              : "Send an anniversary greeting."}{" "}
            They will see it in their notifications.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Write your message…"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={send} disabled={sending || message.trim().length < 2}>
            {sending ? "Sending…" : "Send"}
          </Button>
          {phone && (
            <Button variant="outline" onClick={openWhatsApp}>
              <MessageCircle className="mr-1 size-4" /> WhatsApp
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
