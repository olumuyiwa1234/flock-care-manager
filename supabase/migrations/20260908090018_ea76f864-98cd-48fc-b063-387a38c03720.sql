ALTER TABLE public.members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Member';

ALTER TABLE public.members ADD CONSTRAINT members_status_check CHECK (status IN ('Member','Worker'));

UPDATE public.members m
SET status = 'Worker'
WHERE m.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = m.user_id AND ur.role <> 'member'::app_role
  );