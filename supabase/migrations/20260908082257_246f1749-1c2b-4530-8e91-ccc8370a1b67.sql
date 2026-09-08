CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  body text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcements_select ON public.announcements
  FOR SELECT TO authenticated USING (is_active OR app.has_full_access(auth.uid()));
CREATE POLICY announcements_insert ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND app.has_full_access(auth.uid()));
CREATE POLICY announcements_update ON public.announcements
  FOR UPDATE TO authenticated USING (app.has_full_access(auth.uid())) WITH CHECK (app.has_full_access(auth.uid()));
CREATE POLICY announcements_delete ON public.announcements
  FOR DELETE TO authenticated USING (app.has_full_access(auth.uid()));

CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.announcement_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.announcement_dismissals TO authenticated;
GRANT ALL ON public.announcement_dismissals TO service_role;

ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY dismissals_select_own ON public.announcement_dismissals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY dismissals_insert_own ON public.announcement_dismissals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY dismissals_delete_own ON public.announcement_dismissals
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX announcements_active_idx ON public.announcements (is_active, created_at DESC);