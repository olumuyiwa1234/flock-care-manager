// ============================================================================
// Streaming endpoint for the "Ask AI" chat tile (POST /api/chat).
// The browser's chat library posts the conversation here; the handler verifies
// the signed-in caller, then streams the assistant's answer back as a UI
// message stream while saving each completed answer to their transcript.
// ============================================================================

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { UIMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import { handleShepherdChat } from "@/lib/ai-chat.server";

// Small JSON response helper for the error paths.
function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// POST /api/chat — verify the caller, stream the answer, persist the result.
async function postChat({ request }: { request: Request }) {
  // --- 1. Verify the caller -------------------------------------------------
  // Server routes do not get the site auth middleware, so we validate the
  // bearer token the same way the protected server functions do.
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token || token.split(".").length !== 3) {
    return jsonError(401, "You need to be signed in to use Ask AI.");
  }

  // One-off Supabase client that acts as the signed-in caller (RLS applies).
  const supabase = createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );

  // Confirm the token is valid and find out who is calling.
  const { data, error: claimsError } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (claimsError || !userId) {
    return jsonError(401, "Your session has expired. Please sign in again.");
  }

  // --- 2. Read the conversation the browser sent ----------------------------
  let body: { messages?: UIMessage[] };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request.");
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return jsonError(400, "No question was provided.");
  }

  // --- 3. Persistence for completed answers ---------------------------------
  // Saves each finished assistant message to this caller's transcript; the
  // database's unique index makes re-saves (retries) harmless.
  const persist = async (message: { messageId: string; role: string; parts: unknown }) => {
    const { error } = await supabase.from("ai_chat_messages").upsert(
      {
        user_id: userId,
        message_id: message.messageId,
        role: message.role,
        parts: message.parts as Database["public"]["Tables"]["ai_chat_messages"]["Insert"]["parts"],
      },
      { onConflict: "user_id,message_id" },
    );
    if (error) console.error("[ask-ai] failed to save assistant message", error.message);
  };

  // --- 4. Stream the answer through the Lovable AI Gateway ------------------
  const { response } = handleShepherdChat(request, { messages, persist });
  return response();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: postChat,
    },
  },
});
