-- Each testimony is either public (all signed-in users) or private (author + pastorate only).
ALTER TABLE public.testimonies ADD COLUMN visibility text NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public','private'));

-- Replace the open read rule with one that respects the chosen visibility.
DROP POLICY IF EXISTS "Signed-in users read testimonies" ON public.testimonies;
CREATE POLICY "Read testimonies by visibility" ON public.testimonies
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR (app.is_approved(auth.uid()) AND app.has_role(auth.uid(), 'pastorate'))
  );