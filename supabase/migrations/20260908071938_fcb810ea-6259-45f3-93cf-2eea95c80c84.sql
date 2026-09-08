ALTER TABLE public.members ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS members_parent_id_idx ON public.members(parent_id);