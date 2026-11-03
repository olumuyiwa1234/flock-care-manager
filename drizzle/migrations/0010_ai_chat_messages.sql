-- Chat transcript for the Ask AI tile. One conversation per signed-in user; each row is one message.
CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  parts JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Data API access: only signed-in users, and only through owner-scoped policies below.
GRANT SELECT, INSERT, DELETE ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_messages TO service_role;

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can read only their own conversation.
CREATE POLICY "Users can read their own chat messages"
ON public.ai_chat_messages FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can add only their own messages.
CREATE POLICY "Users can insert their own chat messages"
ON public.ai_chat_messages FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can delete only their own messages.
CREATE POLICY "Users can delete their own chat messages"
ON public.ai_chat_messages FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Prevent a duplicate row if the same message id is saved twice.
CREATE UNIQUE INDEX ai_chat_messages_user_message_id_key
ON public.ai_chat_messages (user_id, message_id);