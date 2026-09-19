-- 1. Add nullable project_id columns
ALTER TABLE public.project_status_events ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.field_reports ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.deviations ADD COLUMN IF NOT EXISTS project_id uuid;

-- 2. Backfill from projects.ref (fallback: ref holding the project uuid text)
UPDATE public.project_status_events e SET project_id = p.id
FROM public.projects p
WHERE e.project_id IS NULL AND (p.ref = e.project_ref OR p.id::text = e.project_ref);

UPDATE public.field_reports f SET project_id = p.id
FROM public.projects p
WHERE f.project_id IS NULL AND (p.ref = f.project_ref OR p.id::text = f.project_ref);

UPDATE public.deviations d SET project_id = p.id
FROM public.projects p
WHERE d.project_id IS NULL AND (p.ref = d.project_ref OR p.id::text = d.project_ref);

-- 3. Admin-only unmatched report, then abort if anything is unmatched
INSERT INTO public.reporting_migration_unmatched (table_name, row_id, raw_project_id)
SELECT 'project_status_events', e.id, e.project_ref FROM public.project_status_events e WHERE e.project_id IS NULL
UNION ALL
SELECT 'field_reports', f.id, f.project_ref FROM public.field_reports f WHERE f.project_id IS NULL
UNION ALL
SELECT 'deviations', d.id, d.project_ref FROM public.deviations d WHERE d.project_id IS NULL;

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM (
    SELECT 1 FROM public.project_status_events WHERE project_id IS NULL
    UNION ALL SELECT 1 FROM public.field_reports WHERE project_id IS NULL
    UNION ALL SELECT 1 FROM public.deviations WHERE project_id IS NULL
  ) s;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Aborting: % rows could not be matched to a project (see reporting_migration_unmatched)', v_count;
  END IF;
END $$;

-- 4. Enforce constraints
ALTER TABLE public.project_status_events
  ALTER COLUMN project_id SET NOT NULL,
  ADD CONSTRAINT project_status_events_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.field_reports
  ALTER COLUMN project_id SET NOT NULL,
  ADD CONSTRAINT field_reports_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

ALTER TABLE public.deviations
  ALTER COLUMN project_id SET NOT NULL,
  ADD CONSTRAINT deviations_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;

-- field_reports: one report per project + installer, keyed on project_id
ALTER TABLE public.field_reports DROP CONSTRAINT IF EXISTS field_reports_project_ref_installer_id_key;
DROP INDEX IF EXISTS public.field_reports_project_ref_installer_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS field_reports_project_installer_key
  ON public.field_reports (project_id, installer_id);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS project_status_events_project_created_idx
  ON public.project_status_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_status_events_to_status_idx
  ON public.project_status_events (to_status);
CREATE INDEX IF NOT EXISTS field_reports_project_idx ON public.field_reports (project_id);
CREATE INDEX IF NOT EXISTS field_reports_submitted_idx ON public.field_reports (submitted_at);
CREATE INDEX IF NOT EXISTS deviations_project_idx ON public.deviations (project_id);
CREATE INDEX IF NOT EXISTS deviations_status_occurred_idx ON public.deviations (status, occurred_at DESC);
CREATE INDEX IF NOT EXISTS deviations_severity_idx ON public.deviations (severity);

-- 6. project_ref / project_name are immutable historical snapshots
CREATE OR REPLACE FUNCTION public.freeze_project_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_ref IS DISTINCT FROM OLD.project_ref THEN
    RAISE EXCEPTION 'project_ref is an immutable historical snapshot';
  END IF;
  IF TG_TABLE_NAME <> 'field_reports' AND NEW.project_name IS DISTINCT FROM OLD.project_name THEN
    RAISE EXCEPTION 'project_name is an immutable historical snapshot';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'project_id cannot be changed';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_freeze_snapshot ON public.project_status_events;
CREATE TRIGGER trg_freeze_snapshot BEFORE UPDATE ON public.project_status_events
  FOR EACH ROW EXECUTE FUNCTION public.freeze_project_snapshot();
DROP TRIGGER IF EXISTS trg_freeze_snapshot ON public.field_reports;
CREATE TRIGGER trg_freeze_snapshot BEFORE UPDATE ON public.field_reports
  FOR EACH ROW EXECUTE FUNCTION public.freeze_project_snapshot();
DROP TRIGGER IF EXISTS trg_freeze_snapshot ON public.deviations;
CREATE TRIGGER trg_freeze_snapshot BEFORE UPDATE ON public.deviations
  FOR EACH ROW EXECUTE FUNCTION public.freeze_project_snapshot();

-- 7. Status-change trigger writes project_id
CREATE OR REPLACE FUNCTION public.validate_project_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      (project_id, project_ref, project_name, from_status, to_status, changed_by, changed_by_name)
    VALUES (NEW.id, COALESCE(NEW.ref, NEW.id::text), NEW.name, OLD.status, NEW.status,
            COALESCE(auth.uid(), NEW.id), v_name);
  END IF;
  RETURN NEW;
END; $$;

-- 8. RLS: status history scoped by project membership instead of "any signed-in user"
DROP POLICY IF EXISTS "Signed-in users can read status history" ON public.project_status_events;
CREATE POLICY "Admins read status history" ON public.project_status_events
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Members read status history for their projects" ON public.project_status_events
  FOR SELECT TO authenticated USING (is_project_member(project_id));