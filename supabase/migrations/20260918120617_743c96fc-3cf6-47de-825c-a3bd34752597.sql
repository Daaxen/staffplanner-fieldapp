/* ---------- generic reference tables ---------- */
CREATE TABLE IF NOT EXISTS public.ref_project_status (
  code text PRIMARY KEY, label text NOT NULL, sort_order int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ref_project_type (
  code text PRIMARY KEY, label text NOT NULL, sort_order int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ref_installer_type (
  code text PRIMARY KEY, label text NOT NULL, sort_order int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ref_absence_type (
  code text PRIMARY KEY, label text NOT NULL, sort_order int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ref_transport_stop_type (
  code text PRIMARY KEY, label text NOT NULL, sort_order int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ref_time_source (
  code text PRIMARY KEY, label text NOT NULL, sort_order int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.ref_employment_type (
  code text PRIMARY KEY, label text NOT NULL, sort_order int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ref_project_status','ref_project_type','ref_installer_type',
                           'ref_absence_type','ref_transport_stop_type','ref_time_source',
                           'ref_employment_type'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t||'_admin', t);
  END LOOP;
END $$;

INSERT INTO public.ref_project_status (code, label, sort_order) VALUES
  ('open','Unassigned',1),('scheduled','Scheduled',2),('in-progress','In Progress',3),
  ('on-hold','On Hold',4),('completed','Completed',5),('cancelled','Cancelled',6)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_project_type (code, label, sort_order) VALUES
  ('installation','Installation',1),('site-survey','Site Survey',2),('transport','Transport',3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_installer_type (code, label, sort_order) VALUES
  ('own','Own staff',1),('sub-vendor','Sub-vendor',2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_absence_type (code, label, sort_order) VALUES
  ('vacation','Vacation',1),('sick','Sick leave',2),('personal','Personal',3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_transport_stop_type (code, label, sort_order) VALUES
  ('pickup','Pickup',1),('delivery','Delivery',2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_time_source (code, label, sort_order) VALUES
  ('manual','Manual',1),('timer','Timer',2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.ref_employment_type (code, label, sort_order) VALUES
  ('employee','Employee',1),('contractor','Contractor',2),('sub_vendor','Sub-vendor',3)
ON CONFLICT (code) DO NOTHING;

/* ---------- preserve unknown existing values (never delete/reinterpret) ---------- */
INSERT INTO public.ref_project_status (code, label, sort_order, is_approved)
  SELECT DISTINCT p.status, p.status, 99, false FROM public.projects p
  WHERE p.status IS NOT NULL ON CONFLICT (code) DO NOTHING;
INSERT INTO public.ref_project_type (code, label, sort_order, is_approved)
  SELECT DISTINCT p.project_type, p.project_type, 99, false FROM public.projects p
  WHERE p.project_type IS NOT NULL ON CONFLICT (code) DO NOTHING;
INSERT INTO public.ref_installer_type (code, label, sort_order, is_approved)
  SELECT DISTINCT i.type, i.type, 99, false FROM public.installers i
  WHERE i.type IS NOT NULL ON CONFLICT (code) DO NOTHING;
INSERT INTO public.ref_absence_type (code, label, sort_order, is_approved)
  SELECT DISTINCT a.type, a.type, 99, false FROM public.installer_absences a
  WHERE a.type IS NOT NULL ON CONFLICT (code) DO NOTHING;
INSERT INTO public.ref_transport_stop_type (code, label, sort_order, is_approved)
  SELECT DISTINCT s.type, s.type, 99, false FROM public.transport_stops s
  WHERE s.type IS NOT NULL ON CONFLICT (code) DO NOTHING;
INSERT INTO public.ref_time_source (code, label, sort_order, is_approved)
  SELECT DISTINCT t.source, t.source, 99, false FROM public.time_entries t
  WHERE t.source IS NOT NULL ON CONFLICT (code) DO NOTHING;
INSERT INTO public.ref_employment_type (code, label, sort_order, is_approved)
  SELECT DISTINCT pr.employment_type, pr.employment_type, 99, false FROM public.profiles pr
  WHERE NULLIF(btrim(pr.employment_type), '') IS NOT NULL ON CONFLICT (code) DO NOTHING;
INSERT INTO public.expense_rules (category, requires_receipt, receipt_threshold)
  SELECT DISTINCT e.category, false, 0 FROM public.expense_entries e
  WHERE e.category IS NOT NULL ON CONFLICT (category) DO NOTHING;

/* ---------- normalise blank employment_type, then add foreign keys ---------- */
UPDATE public.profiles SET employment_type = NULL WHERE btrim(COALESCE(employment_type,'')) = '';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_fk FOREIGN KEY (status)
    REFERENCES public.ref_project_status(code) ON UPDATE CASCADE,
  ADD CONSTRAINT projects_type_fk FOREIGN KEY (project_type)
    REFERENCES public.ref_project_type(code) ON UPDATE CASCADE;
ALTER TABLE public.installers
  ADD CONSTRAINT installers_type_fk FOREIGN KEY (type)
    REFERENCES public.ref_installer_type(code) ON UPDATE CASCADE;
ALTER TABLE public.installer_absences
  ADD CONSTRAINT installer_absences_type_fk FOREIGN KEY (type)
    REFERENCES public.ref_absence_type(code) ON UPDATE CASCADE;
ALTER TABLE public.transport_stops
  ADD CONSTRAINT transport_stops_type_fk FOREIGN KEY (type)
    REFERENCES public.ref_transport_stop_type(code) ON UPDATE CASCADE;
ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_source_fk FOREIGN KEY (source)
    REFERENCES public.ref_time_source(code) ON UPDATE CASCADE;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_employment_type_fk FOREIGN KEY (employment_type)
    REFERENCES public.ref_employment_type(code) ON UPDATE CASCADE;
ALTER TABLE public.expense_entries
  DROP CONSTRAINT IF EXISTS expense_entries_category_valid,
  ADD CONSTRAINT expense_entries_category_fk FOREIGN KEY (category)
    REFERENCES public.expense_rules(category) ON UPDATE CASCADE;

/* ---------- validated project status transitions ---------- */
CREATE TABLE IF NOT EXISTS public.ref_project_status_transition (
  from_status text NOT NULL REFERENCES public.ref_project_status(code) ON UPDATE CASCADE,
  to_status   text NOT NULL REFERENCES public.ref_project_status(code) ON UPDATE CASCADE,
  PRIMARY KEY (from_status, to_status)
);
GRANT SELECT ON public.ref_project_status_transition TO authenticated;
GRANT ALL ON public.ref_project_status_transition TO service_role;
ALTER TABLE public.ref_project_status_transition ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status transitions readable" ON public.ref_project_status_transition
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "status transitions admin write" ON public.ref_project_status_transition
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.ref_project_status_transition (from_status, to_status) VALUES
  ('open','scheduled'),('open','on-hold'),('open','cancelled'),
  ('scheduled','open'),('scheduled','in-progress'),('scheduled','on-hold'),('scheduled','cancelled'),
  ('in-progress','completed'),('in-progress','on-hold'),('in-progress','cancelled'),
  ('on-hold','open'),('on-hold','scheduled'),('on-hold','in-progress'),('on-hold','cancelled'),
  ('completed','in-progress'),
  ('cancelled','open')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_project_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ref_project_status_transition
      WHERE from_status = OLD.status AND to_status = NEW.status
    ) THEN
      RAISE EXCEPTION 'Status cannot go from % to %', OLD.status, NEW.status;
    END IF;

    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
      INTO v_name FROM public.profiles p WHERE p.id = auth.uid();

    INSERT INTO public.project_status_events
      (project_ref, project_name, from_status, to_status, changed_by, changed_by_name)
    VALUES (COALESCE(NEW.ref, NEW.id::text), NEW.name, OLD.status, NEW.status,
            COALESCE(auth.uid(), NEW.id), v_name);
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_projects_status_transition ON public.projects;
CREATE TRIGGER trg_projects_status_transition
  BEFORE UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_status_change();