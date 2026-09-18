-- Report table for records that cannot be matched to an order.
CREATE TABLE IF NOT EXISTS public.reporting_migration_unmatched (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  raw_project_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reporting_migration_unmatched TO authenticated;
GRANT ALL ON public.reporting_migration_unmatched TO service_role;
ALTER TABLE public.reporting_migration_unmatched ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unmatched report admin read" ON public.reporting_migration_unmatched
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 1. Map any existing text project references (project.ref) onto the real order uuid.
UPDATE public.time_entries t SET project_id = p.id::text FROM public.projects p WHERE p.ref = t.project_id;
UPDATE public.expense_entries t SET project_id = p.id::text FROM public.projects p WHERE p.ref = t.project_id;
UPDATE public.mileage_entries t SET project_id = p.id::text FROM public.projects p WHERE p.ref = t.project_id;
UPDATE public.active_timers t SET project_id = p.id::text FROM public.projects p
  WHERE p.ref = t.project_id;

-- 2. Record anything that still does not resolve to an order, and stop if there is any.
INSERT INTO public.reporting_migration_unmatched (table_name, row_id, raw_project_id)
SELECT 'time_entries', t.id, t.project_id FROM public.time_entries t
 WHERE NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = t.project_id);
INSERT INTO public.reporting_migration_unmatched (table_name, row_id, raw_project_id)
SELECT 'expense_entries', t.id, t.project_id FROM public.expense_entries t
 WHERE NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = t.project_id);
INSERT INTO public.reporting_migration_unmatched (table_name, row_id, raw_project_id)
SELECT 'mileage_entries', t.id, t.project_id FROM public.mileage_entries t
 WHERE NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = t.project_id);

DO $$
DECLARE v_bad int;
BEGIN
  SELECT count(*) INTO v_bad FROM public.reporting_migration_unmatched;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Cannot normalize: % reporting rows do not match an order (see public.reporting_migration_unmatched)', v_bad;
  END IF;
  -- active_timers are transient; drop any that no longer point at an order.
  DELETE FROM public.active_timers t
   WHERE NOT EXISTS (SELECT 1 FROM public.projects p WHERE p.id::text = t.project_id);
END $$;

-- 3. Convert to uuid and add the foreign keys.
--    Financial records use ON DELETE RESTRICT so invoiced work can never be
--    silently lost with an order; active_timers is transient state and cascades.
ALTER TABLE public.time_entries    ALTER COLUMN project_id TYPE uuid USING project_id::uuid;
ALTER TABLE public.expense_entries ALTER COLUMN project_id TYPE uuid USING project_id::uuid;
ALTER TABLE public.mileage_entries ALTER COLUMN project_id TYPE uuid USING project_id::uuid;
ALTER TABLE public.active_timers   ALTER COLUMN project_id TYPE uuid USING project_id::uuid;

ALTER TABLE public.time_entries    ADD CONSTRAINT time_entries_project_fk
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;
ALTER TABLE public.expense_entries ADD CONSTRAINT expense_entries_project_fk
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;
ALTER TABLE public.mileage_entries ADD CONSTRAINT mileage_entries_project_fk
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;
ALTER TABLE public.active_timers   ADD CONSTRAINT active_timers_project_fk
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 4. Names are no longer authoritative: keep them only as historical snapshots.
ALTER TABLE public.time_entries    RENAME COLUMN project_name TO snapshot_project_name;
ALTER TABLE public.time_entries    RENAME COLUMN client_name  TO snapshot_client_name;
ALTER TABLE public.expense_entries RENAME COLUMN project_name TO snapshot_project_name;
ALTER TABLE public.expense_entries RENAME COLUMN client_name  TO snapshot_client_name;
ALTER TABLE public.mileage_entries RENAME COLUMN project_name TO snapshot_project_name;
ALTER TABLE public.mileage_entries RENAME COLUMN client_name  TO snapshot_client_name;
ALTER TABLE public.active_timers   RENAME COLUMN project_name TO snapshot_project_name;

COMMENT ON COLUMN public.time_entries.snapshot_project_name IS 'Historical label captured when the record was created. Not authoritative - join public.projects for the current name.';
COMMENT ON COLUMN public.time_entries.snapshot_client_name IS 'Historical label captured when the record was created. Not authoritative - join public.projects/clients for the current name.';
COMMENT ON COLUMN public.expense_entries.snapshot_project_name IS 'Historical label; join public.projects for the current name.';
COMMENT ON COLUMN public.expense_entries.snapshot_client_name IS 'Historical label; join public.projects/clients for the current name.';
COMMENT ON COLUMN public.mileage_entries.snapshot_project_name IS 'Historical label; join public.projects for the current name.';
COMMENT ON COLUMN public.mileage_entries.snapshot_client_name IS 'Historical label; join public.projects/clients for the current name.';
COMMENT ON COLUMN public.active_timers.snapshot_project_name IS 'Historical label; join public.projects for the current name.';

-- 5. Indexes.
CREATE INDEX IF NOT EXISTS time_entries_project_idx    ON public.time_entries (project_id);
CREATE INDEX IF NOT EXISTS time_entries_installer_idx  ON public.time_entries (installer_id);
CREATE INDEX IF NOT EXISTS expense_entries_project_idx ON public.expense_entries (project_id);
CREATE INDEX IF NOT EXISTS expense_entries_installer_idx ON public.expense_entries (installer_id);
CREATE INDEX IF NOT EXISTS mileage_entries_project_idx ON public.mileage_entries (project_id);
CREATE INDEX IF NOT EXISTS mileage_entries_installer_idx ON public.mileage_entries (installer_id);
CREATE INDEX IF NOT EXISTS active_timers_project_idx   ON public.active_timers (project_id);
CREATE INDEX IF NOT EXISTS active_timers_installer_idx ON public.active_timers (installer_id);