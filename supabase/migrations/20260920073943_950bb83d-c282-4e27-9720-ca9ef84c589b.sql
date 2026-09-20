CREATE TABLE public.recurring_order_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_group_id uuid REFERENCES public.project_groups(id) ON DELETE SET NULL,
  project_type text NOT NULL DEFAULT 'installation' REFERENCES public.ref_project_type(code),
  location text,
  street text,
  postal_code text,
  region text,
  location_lat double precision,
  location_lng double precision,
  contact_name text,
  contact_phone text,
  contact_email text,
  start_time time,
  end_time time,
  estimated_hours numeric,
  description text,
  hourly_rate numeric,
  mileage_rate numeric,
  vehicle_type text,
  template_id text,
  weekdays smallint[] NOT NULL DEFAULT '{}',
  interval_weeks integer NOT NULL DEFAULT 1,
  series_start date NOT NULL,
  series_end date NOT NULL,
  skip_holidays boolean NOT NULL DEFAULT true,
  pauses jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_series_date_range CHECK (series_end >= series_start),
  CONSTRAINT recurring_series_interval CHECK (interval_weeks BETWEEN 1 AND 52)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_order_series TO authenticated;
GRANT ALL ON public.recurring_order_series TO service_role;

ALTER TABLE public.recurring_order_series ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects
  ADD COLUMN recurrence_series_id uuid REFERENCES public.recurring_order_series(id) ON DELETE SET NULL;

CREATE INDEX projects_recurrence_series_idx ON public.projects(recurrence_series_id);

CREATE POLICY "Admins and HR manage recurring series"
ON public.recurring_order_series
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Installers view series behind their orders"
ON public.recurring_order_series
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.recurrence_series_id = recurring_order_series.id
      AND public.is_project_member(p.id)
  )
);

CREATE TRIGGER update_recurring_order_series_updated_at
BEFORE UPDATE ON public.recurring_order_series
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();