CREATE TABLE public.project_status_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_ref text NOT NULL,
  project_name text,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by uuid NOT NULL,
  changed_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_status_events_ref ON public.project_status_events (project_ref, created_at DESC);

GRANT SELECT, INSERT ON public.project_status_events TO authenticated;
GRANT ALL ON public.project_status_events TO service_role;

ALTER TABLE public.project_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read status history"
ON public.project_status_events FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users log status changes under their own name"
ON public.project_status_events FOR INSERT TO authenticated
WITH CHECK (changed_by = auth.uid());