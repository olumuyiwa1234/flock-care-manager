// ============================================================================
// Server-only helpers for the "Ask AI" chat feature (Bible / advice / RCCG).
// This module must NEVER be imported by browser code — it holds the AI Gateway
// provider, the system prompt and the run-ID plumbing.
// ============================================================================

import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

// ---------------------------------------------------------------------------
// Run-ID plumbing (copied gateway helper).
// The gateway mints an X-Lovable-AIG-Run-ID per request; we reuse the one that
// arrived on the incoming request so every call of the same run is grouped in
// the AI Gateway logs. We never invent an ID ourselves.
// ---------------------------------------------------------------------------

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

// Wraps fetch so a known run ID is re-sent and the minted one is captured.
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });

  // Publish the first non-empty run ID seen and wake up anyone waiting for it.
  const publishRunId = (value?: string) => {
    const nextRunId = value?.trim() || undefined;
    if (!runId && nextRunId) {
      runId = nextRunId;
    }
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      // Re-send the run ID we already know (unless the caller set its own).
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }

      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (error) {
        publishRunId(undefined);
        throw error;
      }
    },
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  };
}

// Read the run ID that arrived on the incoming app request, if any.
export function getLovableAiGatewayRunId(request: Request) {
  return request.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
}

// Copy every X-Lovable-AIG-* response header onto the outgoing response so the
// browser can see them, and expose them via CORS.
export function getLovableAiGatewayResponseHeaders(
  providerHeaders: HeadersInit | undefined,
  init?: HeadersInit,
) {
  const headers = new Headers(init);
  const exposedHeaders = new Set(
    (headers.get("Access-Control-Expose-Headers") ?? "")
      .split(",")
      .map((header) => header.trim())
      .filter(Boolean),
  );

  new Headers(providerHeaders).forEach((value, name) => {
    if (name.toLowerCase().startsWith("x-lovable-aig-")) {
      headers.set(name, value);
      exposedHeaders.add(name);
    }
  });

  headers.forEach((_, name) => {
    if (name.toLowerCase().startsWith("x-lovable-aig-")) {
      exposedHeaders.add(name);
    }
  });

  if (exposedHeaders.size > 0) {
    headers.set("Access-Control-Expose-Headers", Array.from(exposedHeaders).join(", "));
  }

  return headers;
}

// Stream a response through while attaching the run ID, without buffering it.
export async function withLovableAiGatewayRunIdHeader(
  response: Response,
  gateway: {
    getRunId: () => string | undefined;
    waitForRunId: () => Promise<string | undefined>;
  },
  init?: HeadersInit,
  options: { waitForUpstreamHeaders?: boolean } = {},
) {
  // No body (e.g. an error response): just rebuild it with the run ID headers.
  if (!response.body) {
    const runId = gateway.getRunId();
    const headers = getLovableAiGatewayResponseHeaders(undefined, response.headers);
    new Headers(init).forEach((value, name) => headers.set(name, value));
    if (runId) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: getLovableAiGatewayResponseHeaders(undefined, headers),
    });
  }

  const reader = response.body.getReader();
  const firstChunk = reader.read();
  // Wait for the gateway to tell us the run ID (arrives with the first
  // upstream response headers) so it can be attached before streaming starts.
  const runId =
    options.waitForUpstreamHeaders === false ? gateway.getRunId() : await gateway.waitForRunId();
  const headers = getLovableAiGatewayResponseHeaders(undefined, response.headers);
  new Headers(init).forEach((value, name) => headers.set(name, value));
  if (runId) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);

  // Re-pipe the original body chunk by chunk so streaming stays live.
  const body = new ReadableStream({
    async start(controller) {
      try {
        const first = await firstChunk;
        if (first.done) {
          controller.close();
          return;
        }
        controller.enqueue(first.value);
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          controller.enqueue(chunk.value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason?: unknown) {
      return reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: getLovableAiGatewayResponseHeaders(undefined, headers),
  });
}

// ---------------------------------------------------------------------------
// Assistant identity and instructions. Kept here so the prompt stays on the
// server and out of the browser bundle.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Shepherd Assistant, a warm and knowledgeable AI helper for Hope Holl Assembly, a parish of the Redeemed Christian Church of God (RCCG). You are talking to a signed-in member of the church.

You help members with:
- Bible questions: explain passages, people, events and doctrines. Quote scripture accurately as "Book Chapter:Verse" and never invent a verse or reference; if you are not sure of an exact reference, say so.
- Practical Christian advice: faith, prayer, family, work, relationships and daily living, grounded in biblical principles and offered with balance and humility.
- Questions about RCCG: its history (founded in 1952 by Pa Josiah Akindayomi in Lagos, Nigeria; General Overseer Pastor Enoch Adeboye since 1981), mission, vision, structure and programmes such as Digging Deep, Faith Clinic, Holy Ghost Service, Let's-Go-A-Fishing and the Convention.
- Church life: the parish holds Sunday Service, Digging Deep on Tuesdays and Faith Clinic on Thursdays.

Style guidelines:
- Answer in the language and tone the member writes in; keep a warm, respectful, encouraging pastoral tone.
- Use markdown: short paragraphs, and headings or bullet lists when they help readability.
- Be concise: usually under 350 words unless the member asks for more depth.
- You are an AI assistant, not a human pastor. Never claim to be a pastor or a person.
- For urgent personal, medical, financial or emotional crises, gently suggest speaking with the pastor through the "Contact Pastor" page in the app, and for emergencies contact the appropriate local emergency service.
- If a question is unclear, ask a brief clarifying question before answering.`;

// ---------------------------------------------------------------------------
// The gateway call. Creates the provider per request, streams the answer and
// hands back a UI-message stream the browser can render while it arrives.
// ---------------------------------------------------------------------------

// Turn gateway failures into short, safe messages the UI can show directly.
function safeGatewayError(error: unknown): string {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  if (status === 429) return "The AI assistant is busy right now. Please try again in a moment.";
  if (status === 402) return "AI credits have run out for this workspace. Please top up to keep using Ask AI.";
  if (status === 403) return "The AI assistant is not available for this account right now.";
  if (status === 401) return "AI is not configured. Please contact your church admin.";
  return "The AI assistant could not answer right now. Please try again shortly.";
}

export function handleShepherdChat(
  request: Request,
  opts: {
    // The whole conversation as UI messages (history + the new question).
    messages: UIMessage[];
    // Saves one completed assistant message to the caller's transcript.
    persist: (message: { messageId: string; role: string; parts: unknown }) => Promise<void>;
  },
) {
  // The key lives only on the server; fail with a clear message when missing.
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  if (!lovableApiKey) {
    throw new Error("Lovable AI is not configured. Please contact your church admin.");
  }

  // Request-scoped run-ID wrapper so follow-up steps share one gateway run.
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));

  // OpenAI provider pointed at the Lovable AI Gateway, on the Responses API.
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: lovableApiKey,
    headers: { "Lovable-API-Key": lovableApiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  // Stream the answer. store:false is mandatory (the gateway keeps nothing);
  // the reasoning options carry thinking across turns so history keeps working.
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(opts.messages),
    abortSignal: request.signal,
    maxRetries: 0,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return {
    response: () =>
      withLovableAiGatewayRunIdHeader(
        result.toUIMessageStreamResponse({
          originalMessages: opts.messages,
          sendReasoning: true,
          onError: safeGatewayError,
          // When the UI message stream finishes, hand the completed assistant
          // message to the caller for persistence (re-saves are ignored).
          onEnd: async (event) => {
            const last = event.messages[event.messages.length - 1];
            if (!last || last.role !== "assistant") return;
            // Keep partial answers from an aborted stream, but skip empty ones.
            const hasText = last.parts.some(
              (p) => p.type === "text" && p.text.trim().length > 0,
            );
            if (!hasText) return;
            try {
              await opts.persist({ messageId: last.id, role: last.role, parts: last.parts });
            } catch (error) {
              // Persistence must never break the streamed answer; log only.
              console.error("[ask-ai] failed to save assistant message", error);
            }
          },
        }),
        runIdFetch,
      ),
  };
}
