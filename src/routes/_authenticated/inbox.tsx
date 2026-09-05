import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { formatDate } from "@/lib/shepherd";
import { useAuth } from "@/lib/useAuth";
import { Lightbulb, MessageSquareHeart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Pastor Inbox — Shepherd" },
      {
        name: "description",
        content: "Read all member feedback and private pastor messages, grouped by date and sender.",
      },
      { property: "og:title", content: "Pastor Inbox — Shepherd" },
      { property: "og:description", content: "All member feedback and messages in one place." },
    ],
  }),
  component: Inbox,
});

type Item = {
  id: string;
  kind: "feedback" | "message";
  author: string;
  subject: string | null;
  body: string;
  createdAt: string;
};

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function Inbox() {
  const { isPastor } = useAuth();

  const query = useQuery({
    queryKey: ["pastor-inbox"],
    enabled: isPastor,
    queryFn: async (): Promise<Item[]> => {
      const [fb, pm] = await Promise.all([
        supabase
          .from("suggestions")
          .select("id, author_name, content, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("pastor_messages")
          .select("id, author_name, subject, message, created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (fb.error) throw fb.error;
      if (pm.error) throw pm.error;

      const items: Item[] = [
        ...(fb.data ?? []).map((r) => ({
          id: `f-${r.id}`,
          kind: "feedback" as const,
          author: r.author_name || "Member",
          subject: null,
          body: r.content,
          createdAt: r.created_at,
        })),
        ...(pm.data ?? []).map((r) => ({
          id: `m-${r.id}`,
          kind: "message" as const,
          author: r.author_name || "Member",
          subject: r.subject,
          body: r.message,
          createdAt: r.created_at,
        })),
      ];
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  });

  if (!isPastor) {
    return (
      <AppShell title="Pastor Inbox" subtitle="Restricted" back="/home">
        <EmptyState title="Not available" hint="Only the Pastor can open this page." />
      </AppShell>
    );
  }

  const items = query.data ?? [];
  const days = Array.from(new Set(items.map((i) => dayKey(i.createdAt))));

  return (
    <AppShell title="Pastor Inbox" subtitle="Feedback & messages" back="/home">
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing yet" hint="Feedback and messages from members will appear here." />
      ) : (
        <div className="space-y-6">
          {days.map((day) => {
            const dayItems = items.filter((i) => dayKey(i.createdAt) === day);
            const senders = Array.from(new Set(dayItems.map((i) => i.author)));
            return (
              <section key={day}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {formatDate(day)}
                </h2>
                <div className="space-y-3">
                  {senders.map((sender) => (
                    <div key={sender} className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-sm font-semibold">{sender}</p>
                      <ul className="mt-2 space-y-3">
                        {dayItems
                          .filter((i) => i.author === sender)
                          .map((i) => (
                            <li key={i.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {i.kind === "feedback" ? (
                                  <Lightbulb className="h-3.5 w-3.5" />
                                ) : (
                                  <MessageSquareHeart className="h-3.5 w-3.5" />
                                )}
                                <span>{i.kind === "feedback" ? "Feedback" : "Message to pastor"}</span>
                                <span className="ml-auto">
                                  {new Date(i.createdAt).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              {i.subject && <p className="mt-1 text-sm font-medium">{i.subject}</p>}
                              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                                {i.body}
                              </p>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
