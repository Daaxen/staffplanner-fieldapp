
CREATE TABLE IF NOT EXISTS public.ref_commercial_status (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ref_commercial_status TO authenticated;
GRANT ALL ON public.ref_commercial_status TO service_role;
ALTER TABLE public.ref_commercial_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commercial status readable" ON public.ref_commercial_status;
CREATE POLICY "commercial status readable" ON public.ref_commercial_status FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "commercial status admin manage" ON public.ref_commercial_status;
CREATE POLICY "commercial status admin manage" ON public.ref_commercial_status FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.ref_commercial_status (code,label,sort_order) VALUES
  ('quote','Quote',10),
  ('order_received','Order Received',20),
  ('planned','Planned',30),
  ('scheduled','Scheduled',40),
  ('in_progress','In Progress',50),
  ('ready_for_invoice','Ready For Invoice',60),
  ('invoiced','Invoiced',70),
  ('paid','Paid',80),
  ('closed','Closed',90)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ref_commercial_status_transition (
  from_status text NOT NULL REFERENCES public.ref_commercial_status(code),
  to_status text NOT NULL REFERENCES public.ref_commercial_status(code),
  PRIMARY KEY (from_status, to_status)
);
GRANT SELECT ON public.ref_commercial_status_transition TO authenticated;
GRANT ALL ON public.ref_commercial_status_transition TO service_role;
ALTER TABLE public.ref_commercial_status_transition ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commercial transitions readable" ON public.ref_commercial_status_transition;
CREATE POLICY "commercial transitions readable" ON public.ref_commercial_status_transition FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "commercial transitions admin manage" ON public.ref_commercial_status_transition;
CREATE POLICY "commercial transitions admin manage" ON public.ref_commercial_status_transition FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.ref_commercial_status_transition (from_status,to_status) VALUES
  ('quote','order_received'),
  ('order_received','planned'), ('order_received','quote'),
  ('planned','scheduled'), ('planned','order_received'),
  ('scheduled','in_progress'), ('scheduled','planned'),
  ('in_progress','ready_for_invoice'), ('in_progress','scheduled'),
  ('ready_for_invoice','invoiced'), ('ready_for_invoice','in_progress'),
  ('invoiced','paid'), ('invoiced','ready_for_invoice'),
  ('paid','closed'), ('paid','invoiced'),
  ('quote','closed'), ('order_received','closed'), ('planned','closed'),
  ('scheduled','closed'), ('in_progress','closed'), ('ready_for_invoice','closed'),
  ('invoiced','closed'),
  ('closed','paid')
ON CONFLICT DO NOTHING;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS commercial_status text NOT NULL DEFAULT 'quote'
  REFERENCES public.ref_commercial_status(code);
CREATE INDEX IF NOT EXISTS projects_commercial_status_idx ON public.projects (commercial_status);

CREATE TABLE IF NOT EXISTS public.commercial_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_name text,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by uuid,
  changed_by_name text,
  changed_by_type text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commercial_status_events_project_idx ON public.commercial_status_events (project_id, created_at DESC);
GRANT SELECT ON public.commercial_status_events TO authenticated;
GRANT ALL ON public.commercial_status_events TO service_role;
ALTER TABLE public.commercial_status_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commercial events admin read" ON public.commercial_status_events;
CREATE POLICY "commercial events admin read" ON public.commercial_status_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.validate_commercial_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name text;
  v_type text := CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END;
BEGIN
  IF NEW.commercial_status IS NOT DISTINCT FROM OLD.commercial_status THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ref_commercial_status_transition
    WHERE from_status = OLD.commercial_status AND to_status = NEW.commercial_status
  ) THEN
    RAISE EXCEPTION 'Commercial status cannot go from % to %', OLD.commercial_status, NEW.commercial_status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(full_name, email) INTO v_name FROM public.profiles WHERE id = v_actor;
  INSERT INTO public.commercial_status_events
    (project_id, project_name, from_status, to_status, changed_by, changed_by_name, changed_by_type)
  VALUES (NEW.id, NEW.name, OLD.commercial_status, NEW.commercial_status, v_actor, v_name, v_type);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_commercial_transition ON public.projects;
CREATE TRIGGER trg_projects_commercial_transition
  BEFORE UPDATE OF commercial_status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_commercial_status_change();

-- track the commercial step in the change log as well
DROP TRIGGER IF EXISTS trg_audit_projects_upd ON public.projects;
CREATE TRIGGER trg_audit_projects_upd AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'project','name','status','commercial_status','start_date','end_date','client_id','client_ref',
    'client_name','hourly_rate','mileage_rate','location','project_type','name');

DROP TRIGGER IF EXISTS trg_audit_commercial_events ON public.commercial_status_events;
CREATE TRIGGER trg_audit_commercial_events
  AFTER INSERT OR UPDATE OR DELETE ON public.commercial_status_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('commercial_status','project_name','to_status');
