CREATE TABLE public.deviations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_ref text NOT NULL,
  project_name text,
  installer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installer_name text,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  description text NOT NULL,
  photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deviations TO authenticated;
GRANT ALL ON public.deviations TO service_role;

ALTER TABLE public.deviations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Installers manage own deviations" ON public.deviations
  FOR ALL TO authenticated
  USING (installer_id = auth.uid())
  WITH CHECK (installer_id = auth.uid());

CREATE POLICY "Admins read all deviations" ON public.deviations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update deviations" ON public.deviations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_deviations_updated BEFORE UPDATE ON public.deviations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_deviations_project_ref ON public.deviations(project_ref);
CREATE INDEX idx_deviations_status ON public.deviations(status);