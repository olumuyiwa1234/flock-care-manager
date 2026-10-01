CREATE TABLE public.testimonies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL,
  title text,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.testimonies TO authenticated;
GRANT ALL ON public.testimonies TO service_role;
ALTER TABLE public.testimonies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read testimonies" ON public.testimonies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users share own testimonies" ON public.testimonies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners or full-access delete testimonies" ON public.testimonies FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR app.has_full_access(auth.uid()));