-- One row per daily celebration announcement run.
CREATE TABLE public.celebration_push_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  body text NOT NULL,
  celebrants text[] NOT NULL DEFAULT '{}',
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- One row per device the run tried to reach.
CREATE TABLE public.celebration_push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.celebration_push_runs(id) ON DELETE CASCADE,
  user_id uuid,
  recipient_name text,
  platform text,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.celebration_push_runs TO authenticated;
GRANT SELECT ON public.celebration_push_deliveries TO authenticated;
GRANT ALL ON public.celebration_push_runs TO service_role;
GRANT ALL ON public.celebration_push_deliveries TO service_role;
ALTER TABLE public.celebration_push_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celebration_push_deliveries ENABLE ROW LEVEL SECURITY;
-- Only full-access staff (Pastor, Parish Coordinator, Admin) can read the log.
CREATE POLICY "Full access reads push runs" ON public.celebration_push_runs
  FOR SELECT TO authenticated USING (app.has_full_access(auth.uid()));
CREATE POLICY "Full access reads push deliveries" ON public.celebration_push_deliveries
  FOR SELECT TO authenticated USING (app.has_full_access(auth.uid()));