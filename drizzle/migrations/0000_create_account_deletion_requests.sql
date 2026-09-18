-- Requests to delete an account, which must be approved by the pastorate first.
CREATE TABLE public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  member_name text NOT NULL DEFAULT '',
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by_name text NOT NULL DEFAULT '',
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Data API access: only signed-in staff touch this table.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Only full-access staff (Pastorate / Admin) may see or raise deletion requests.
CREATE POLICY deletion_requests_select ON public.deletion_requests
  FOR SELECT TO authenticated
  USING (app.has_full_access(auth.uid()));

CREATE POLICY deletion_requests_insert ON public.deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND app.has_full_access(auth.uid()));

-- Only the pastorate can approve or decline a request.
CREATE POLICY deletion_requests_update ON public.deletion_requests
  FOR UPDATE TO authenticated
  USING (app.has_role(auth.uid(), 'pastorate'::public.app_role))
  WITH CHECK (app.has_role(auth.uid(), 'pastorate'::public.app_role));

CREATE POLICY deletion_requests_delete ON public.deletion_requests
  FOR DELETE TO authenticated
  USING (app.has_role(auth.uid(), 'pastorate'::public.app_role));

CREATE INDEX deletion_requests_status_idx ON public.deletion_requests (status, created_at DESC);
