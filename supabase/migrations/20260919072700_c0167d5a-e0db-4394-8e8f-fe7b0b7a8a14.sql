CREATE TABLE public.job_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id text,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  customer text,
  city text,
  order_type text,
  category text,
  installer_ids uuid[] NOT NULL DEFAULT '{}',
  planned_hours numeric,
  actual_hours numeric NOT NULL DEFAULT 0,
  travel_hours numeric NOT NULL DEFAULT 0,
  planned_installers integer NOT NULL DEFAULT 0,
  actual_installers integer NOT NULL DEFAULT 0,
  planned_date date,
  completed_date date NOT NULL DEFAULT CURRENT_DATE,
  material_cost numeric NOT NULL DEFAULT 0,
  job_value numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX job_metrics_project_unique ON public.job_metrics (project_id);
CREATE INDEX job_metrics_customer_idx ON public.job_metrics (customer);
CREATE INDEX job_metrics_completed_idx ON public.job_metrics (completed_date);

GRANT SELECT ON public.job_metrics TO authenticated;
GRANT ALL ON public.job_metrics TO service_role;

ALTER TABLE public.job_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read job metrics"
ON public.job_metrics FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- History must never change: block all edits and deletions.
CREATE OR REPLACE FUNCTION public.job_metrics_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Job metrics history cannot be changed or deleted';
END;
$$;

CREATE TRIGGER trg_job_metrics_immutable
BEFORE UPDATE OR DELETE ON public.job_metrics
FOR EACH ROW EXECUTE FUNCTION public.job_metrics_immutable();

-- Automatic snapshot when an order is marked completed.
CREATE OR REPLACE FUNCTION public.capture_job_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_installers uuid[];
  v_hours numeric;
  v_actual int;
  v_mat numeric;
  v_value numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND NOT EXISTS (SELECT 1 FROM public.job_metrics WHERE project_id = NEW.id) THEN

    SELECT coalesce(array_agg(installer_id), '{}')
      INTO v_installers
      FROM public.project_assignees
     WHERE project_id = NEW.id;

    SELECT coalesce(sum(hours), 0), count(DISTINCT installer_id)
      INTO v_hours, v_actual
      FROM public.time_entries
     WHERE project_id = NEW.id;

    SELECT coalesce(sum(amount), 0)
      INTO v_mat
      FROM public.expense_entries
     WHERE project_id = NEW.id
       AND category IN ('materials', 'material');

    SELECT pe.fixed_price + pe.additional_revenue
      INTO v_value
      FROM public.project_economy pe
     WHERE pe.project_id = NEW.id;

    IF v_value IS NULL AND NEW.estimated_hours IS NOT NULL AND NEW.hourly_rate IS NOT NULL THEN
      v_value := NEW.estimated_hours * NEW.hourly_rate;
    END IF;

    INSERT INTO public.job_metrics (
      order_id, project_id, customer, city, order_type, category,
      installer_ids, planned_hours, actual_hours, travel_hours,
      planned_installers, actual_installers, planned_date, completed_date,
      material_cost, job_value
    ) VALUES (
      NEW.ref, NEW.id, NEW.client_name, NEW.region, NEW.project_type, NEW.template_id,
      v_installers, NEW.estimated_hours, v_hours, 0,
      coalesce(array_length(v_installers, 1), 0), v_actual, NEW.start_date, CURRENT_DATE,
      v_mat, v_value
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_projects_job_metrics
AFTER UPDATE OF status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.capture_job_metrics();

-- Audit new history entries like other critical records.
CREATE TRIGGER trg_audit_job_metrics_ins
AFTER INSERT ON public.job_metrics
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();