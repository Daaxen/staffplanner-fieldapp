-- ---------------------------------------------------------------- clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS customer_number text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS billing_name text,
  ADD COLUMN IF NOT EXISTS billing_street text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_country text,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS org_number text,
  ADD COLUMN IF NOT EXISTS invoice_email text,
  ADD COLUMN IF NOT EXISTS payment_terms_days integer,
  ADD COLUMN IF NOT EXISTS invoice_reference text;

UPDATE public.clients c SET
  customer_number     = COALESCE(c.customer_number, NULLIF(c.data->>'customerNumber','')),
  street              = COALESCE(c.street,          NULLIF(c.data->>'street','')),
  postal_code         = COALESCE(c.postal_code,     NULLIF(c.data->>'postalCode','')),
  region              = COALESCE(c.region,          NULLIF(c.data->>'region','')),
  contact_name        = COALESCE(c.contact_name,    NULLIF(c.data->'mainContact'->>'name','')),
  contact_role        = COALESCE(c.contact_role,    NULLIF(c.data->'mainContact'->>'role','')),
  contact_phone       = COALESCE(c.contact_phone,   NULLIF(c.data->'mainContact'->>'phone','')),
  contact_email       = COALESCE(c.contact_email,   NULLIF(c.data->'mainContact'->>'email','')),
  billing_name        = COALESCE(c.billing_name,        NULLIF(c.data->'invoicing'->>'billingName','')),
  billing_street      = COALESCE(c.billing_street,      NULLIF(c.data->'invoicing'->>'billingStreet','')),
  billing_postal_code = COALESCE(c.billing_postal_code, NULLIF(c.data->'invoicing'->>'billingPostalCode','')),
  billing_city        = COALESCE(c.billing_city,        NULLIF(c.data->'invoicing'->>'billingCity','')),
  billing_country     = COALESCE(c.billing_country,     NULLIF(c.data->'invoicing'->>'billingCountry','')),
  vat_number          = COALESCE(c.vat_number,          NULLIF(c.data->'invoicing'->>'vatNumber','')),
  org_number          = COALESCE(c.org_number,          NULLIF(c.data->'invoicing'->>'orgNumber','')),
  invoice_email       = COALESCE(c.invoice_email,       NULLIF(c.data->'invoicing'->>'invoiceEmail','')),
  payment_terms_days  = COALESCE(c.payment_terms_days,
                          NULLIF(c.data->'invoicing'->>'paymentTermsDays','')::int),
  invoice_reference   = COALESCE(c.invoice_reference,   NULLIF(c.data->'invoicing'->>'reference',''));

-- --------------------------------------------------------------- projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_number text,
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS client_ref text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS start_time time without time zone,
  ADD COLUMN IF NOT EXISTS end_time time without time zone,
  ADD COLUMN IF NOT EXISTS estimated_hours numeric,
  ADD COLUMN IF NOT EXISTS is_flex_order boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS mileage_rate numeric,
  ADD COLUMN IF NOT EXISTS vehicle_type text;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_estimated_hours_nonneg
    CHECK (estimated_hours IS NULL OR estimated_hours >= 0) NOT VALID,
  ADD CONSTRAINT projects_rates_nonneg
    CHECK ((hourly_rate IS NULL OR hourly_rate >= 0)
       AND (mileage_rate IS NULL OR mileage_rate >= 0)) NOT VALID;
ALTER TABLE public.projects VALIDATE CONSTRAINT projects_estimated_hours_nonneg;
ALTER TABLE public.projects VALIDATE CONSTRAINT projects_rates_nonneg;

UPDATE public.projects p SET
  project_number  = COALESCE(p.project_number, NULLIF(p.data->>'projectNumber','')),
  template_id     = COALESCE(p.template_id,    NULLIF(p.data->>'templateId','')),
  client_ref      = COALESCE(p.client_ref,     NULLIF(p.data->>'clientId','')),
  client_name     = COALESCE(p.client_name,    NULLIF(p.data->>'client','')),
  street          = COALESCE(p.street,         NULLIF(p.data->>'street','')),
  postal_code     = COALESCE(p.postal_code,    NULLIF(p.data->>'postalCode','')),
  region          = COALESCE(p.region,         NULLIF(p.data->>'region','')),
  location_lat    = COALESCE(p.location_lat,   NULLIF(p.data->>'locationLat','')::double precision),
  location_lng    = COALESCE(p.location_lng,   NULLIF(p.data->>'locationLng','')::double precision),
  start_time      = COALESCE(p.start_time,     NULLIF(p.data->>'startTime','')::time),
  end_time        = COALESCE(p.end_time,       NULLIF(p.data->>'endTime','')::time),
  estimated_hours = COALESCE(p.estimated_hours, NULLIF(p.data->>'estimatedHours','')::numeric),
  is_flex_order   = COALESCE(NULLIF(p.data->>'isFlexOrder','')::boolean, p.is_flex_order),
  description     = COALESCE(p.description,    NULLIF(p.data->>'description','')),
  hourly_rate     = COALESCE(p.hourly_rate,    NULLIF(p.data->>'hourlyRate','')::numeric),
  mileage_rate    = COALESCE(p.mileage_rate,   NULLIF(p.data->>'mileageRate','')::numeric),
  vehicle_type    = COALESCE(p.vehicle_type,   NULLIF(p.data->>'vehicleType',''));

CREATE INDEX IF NOT EXISTS projects_client_ref_idx ON public.projects (client_ref);

-- --------------------------------------------------------- order economy
CREATE TABLE IF NOT EXISTS public.project_economy (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  fixed_price numeric CHECK (fixed_price IS NULL OR fixed_price >= 0),
  additional_revenue numeric CHECK (additional_revenue IS NULL OR additional_revenue >= 0),
  budget_hours numeric CHECK (budget_hours IS NULL OR budget_hours >= 0),
  internal_hourly_cost numeric CHECK (internal_hourly_cost IS NULL OR internal_hourly_cost >= 0),
  external_hourly_cost numeric CHECK (external_hourly_cost IS NULL OR external_hourly_cost >= 0),
  external_cost_extra numeric CHECK (external_cost_extra IS NULL OR external_cost_extra >= 0),
  material_cost_extra numeric CHECK (material_cost_extra IS NULL OR material_cost_extra >= 0),
  travel_cost_extra numeric CHECK (travel_cost_extra IS NULL OR travel_cost_extra >= 0),
  external_budget numeric CHECK (external_budget IS NULL OR external_budget >= 0),
  target_margin_pct numeric CHECK (target_margin_pct IS NULL OR (target_margin_pct >= 0 AND target_margin_pct <= 100)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_economy TO authenticated;
GRANT ALL ON public.project_economy TO service_role;
ALTER TABLE public.project_economy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project economy admin manage" ON public.project_economy;
CREATE POLICY "project economy admin manage" ON public.project_economy
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_project_economy_updated ON public.project_economy;
CREATE TRIGGER trg_project_economy_updated
  BEFORE UPDATE ON public.project_economy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.project_economy (
  project_id, fixed_price, additional_revenue, budget_hours, internal_hourly_cost,
  external_hourly_cost, external_cost_extra, material_cost_extra, travel_cost_extra,
  external_budget, target_margin_pct)
SELECT p.id,
  NULLIF(p.data->'economy'->>'fixedPrice','')::numeric,
  NULLIF(p.data->'economy'->>'additionalRevenue','')::numeric,
  NULLIF(p.data->'economy'->>'budgetHours','')::numeric,
  NULLIF(p.data->'economy'->>'internalHourlyCost','')::numeric,
  NULLIF(p.data->'economy'->>'externalHourlyCost','')::numeric,
  NULLIF(p.data->'economy'->>'externalCostExtra','')::numeric,
  NULLIF(p.data->'economy'->>'materialCostExtra','')::numeric,
  NULLIF(p.data->'economy'->>'travelCostExtra','')::numeric,
  NULLIF(p.data->'economy'->>'externalBudget','')::numeric,
  NULLIF(p.data->'economy'->>'targetMarginPct','')::numeric
FROM public.projects p
WHERE p.data ? 'economy'
ON CONFLICT (project_id) DO NOTHING;