-- How long a blast announcement should keep popping up.
-- NULL means it keeps showing until an admin stops it manually.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.announcements.expires_at IS 'When the announcement stops popping up for users. NULL = no automatic expiry.';