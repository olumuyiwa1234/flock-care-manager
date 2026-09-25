-- Automatic celebration greetings are sent by the church family, not a user,
-- so sender_id must be allowed to be empty for those rows.
ALTER TABLE public.greetings ALTER COLUMN sender_id DROP NOT NULL;