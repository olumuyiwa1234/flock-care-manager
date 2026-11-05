// ============================================================================
// "Ask AI" page — one conversation per user, saved in the app database.
// Members ask Bible questions, seek advice or ask about RCCG; answers stream
// in from the AI assistant at /api/chat and both sides of the conversation
// are stored so history survives closing the app or changing device.
// ============================================================================

import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, EmptyState } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import { toast } from "sonner";
import askAiIcon from "@/assets/ask-ai.png";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const Route = createFileRoute("/_authenticated/ask-ai")({
  head: () => ({
    meta: [
      { title: "Ask AI — Shepherd" },
      {
        name: "description",
        content: "Ask Bible questions, seek advice and learn about RCCG from the church AI assistant.",
      },
      { property: "og:title", content: "Ask AI — Shepherd" },
      { property: "og:description", content: "Bible answers, advice and church questions from the AI assistant." },
    ],
  }),
  component: AskAI,
});

// A few friendly starter questions shown when the conversation is empty.
const STARTERS = [
  "Who was David in the Bible?",
  "How can I forgive someone who hurt me?",
  "When did the RCCG start?",
  "What is Digging Deep about?",
];

// One chat window, mounted only once the saved history has loaded so the
// conversation starts with the right messages every time.
function ChatWindow({ initialMessages }: { initialMessages: UIMessage[] }) {
  const { auth } = useAuth();

  // Transport: post the conversation to the app's own streaming endpoint.
  // Every request carries the signed-in user's token, which the server
  // verifies before streaming an answer or saving it to the transcript.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [],
  );

  // Wire the chat: optimistic sending, streaming status and error toasts.
  const chat = useChat({
    transport,
    messages: initialMessages,
    onError: (error) => toast.error(error.message || "Something went wrong. Please try again."),
  });

  const busy = chat.status === "submitted" || chat.status === "streaming";

  // Send a question: save the user's message first (so history is complete),
  // then hand the whole conversation to the streaming endpoint.
  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    if (content.length > 2000) {
      toast.error("Please keep questions under 2000 characters.");
      return;
    }
    // Our own message ID so the saved row and the chat message stay in sync.
    const id = crypto.randomUUID();
    const { error } = await supabase.from("ai_chat_messages").insert({
      user_id: auth!.userId,
      message_id: id,
      role: "user",
      parts: [{ type: "text", text: content }],
    });
    // A failed save must not stop the answer; tell the member and continue.
    if (error) toast.error("Your question could not be saved, but the answer will still come.");
    // Send with the same id we saved so the transcript and chat stay in sync.
    chat.sendMessage({ id, parts: [{ type: "text", text: content }] });
  }

  return (
    <div className="flex h-[calc(100dvh-11.5rem)] flex-col">
      {/* Transcript */}
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {chat.messages.length === 0 ? (
            // Empty state: the assistant's identity plus starter questions.
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <img
                src={askAiIcon}
                alt="Ask AI"
                width={96}
                height={96}
                loading="lazy"
                className="size-24 rounded-2xl shadow-tile"
              />
              <div>
                <p className="font-semibold">Ask anything about faith</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Bible questions, advice for daily living, RCCG history and church life.
                </p>
              </div>
              <div className="flex max-w-md flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-sm transition hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.messages.map((message) => {
              // Assistant answers get markdown; user bubbles keep plain text.
              const text = message.parts
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("");
              return (
                <Message
                  key={message.id}
                  from={message.role === "user" ? "user" : "assistant"}
                >
                  <MessageContent>
                    {message.role === "assistant" ? (
                      <MessageResponse>{text}</MessageResponse>
                    ) : (
                      text
                    )}
                  </MessageContent>
                </Message>
              );
            })
          )}
          {/* Waiting indicator while the assistant is thinking/streaming */}
          {chat.status === "submitted" && (
            <div className="text-sm text-muted-foreground">
              <Shimmer>Thinking…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <PromptInput
        className="mt-2"
        onSubmit={({ text }) => void send(text ?? "")}
      >
        <PromptInputTextarea
          placeholder="Ask a Bible question or seek advice…"
          maxLength={2000}
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit
            status={chat.status}
            disabled={chat.status === "submitted"}
            onStop={() => chat.stop()}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

function AskAI() {
  // The saved conversation for the signed-in user, oldest first.
  const history = useQuery({
    queryKey: ["ai-chat-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("message_id, role, parts")
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      // Map rows back to the message shape the chat library expects.
      return (data ?? []).map(
        (row): UIMessage => ({
          id: row.message_id,
          role: row.role as UIMessage["role"],
          parts: row.parts as UIMessage["parts"],
        }),
      );
    },
  });

  return (
    <AppShell title="Ask AI" subtitle="Bible answers, advice and church questions" back="/home">
      {history.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {history.isError && (
        <EmptyState title="Could not load your conversation" hint={history.error.message} />
      )}
      {history.isSuccess && <ChatWindow initialMessages={history.data} />}
    </AppShell>
  );
}
