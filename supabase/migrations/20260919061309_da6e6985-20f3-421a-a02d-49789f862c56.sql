-- 1. Sensitive project documents are not readable by project members
DROP POLICY IF EXISTS "documents scoped read" ON public.documents;
CREATE POLICY "documents scoped read" ON public.documents FOR SELECT TO authenticated USING (
  (scope = 'global_internal' AND visible_to_installers = true AND is_sensitive = false)
  OR (scope = 'project' AND project_id IS NOT NULL AND is_sensitive = false AND public.is_project_member(project_id))
  OR (scope = 'installer_private' AND owner_id = auth.uid())
);

-- 2. Least privilege on the staff register: authenticated users may only read
REVOKE INSERT, UPDATE, DELETE ON public.installers FROM authenticated;

-- 3. Status history: never record the project id as the actor
ALTER TABLE public.project_status_events ALTER COLUMN changed_by DROP NOT NULL;
ALTER TABLE public.project_status_events ADD COLUMN IF NOT EXISTS changed_by_type text NOT NULL DEFAULT 'user';
ALTER TABLE public.project_status_events DROP CONSTRAINT IF EXISTS project_status_events_actor_type_valid;
ALTER TABLE public.project_status_events ADD CONSTRAINT project_status_events_actor_type_valid
  CHECK (changed_by_type IN ('user','service','system','migration'));
-- historical rows whose changed_by is not a real account were automatic changes
UPDATE public.project_status_events se
   SET changed_by = NULL, changed_by_type = 'system'
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = se.changed_by);

CREATE OR REPLACE FUNCTION public.validate_project_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_actor_type text := NULLIF(current_setting('app.actor_type', true), '');
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ref_project_status_transition
      WHERE from_status = OLD.status AND to_status = NEW.status
    ) THEN
      RAISE EXCEPTION 'Status cannot go from % to %', OLD.status, NEW.status;
    END IF;

    IF v_actor_type IS NULL OR v_actor_type NOT IN ('user','service','system','migration') THEN
      v_actor_type := CASE
        WHEN auth.uid() IS NOT NULL THEN 'user'
        WHEN current_user = 'service_role' THEN 'service'
        ELSE 'system'
      END;
    END IF;

    SELECT COALESCE(NULLIF(btrim(p.full_name), ''), p.email)
      INTO v_name FROM public.profiles p WHERE p.id = auth.uid();
    v_name := COALESCE(v_name, NULLIF(current_setting('app.actor_name', true), ''),
                       CASE v_actor_type WHEN 'user' THEN NULL ELSE current_user END);

    INSERT INTO public.project_status_events
      (project_id, project_ref, project_name, from_status, to_status,
       changed_by, changed_by_type, changed_by_name)
    VALUES (NEW.id, COALESCE(NEW.ref, NEW.id::text), NEW.name, OLD.status, NEW.status,
            auth.uid(), v_actor_type, v_name);
  END IF;
  RETURN NEW;
END; $function$;

-- 4. Reject zero-length bookings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.assignments WHERE planned_end_at <= planned_start_at) THEN
    RAISE EXCEPTION 'Existing zero-length bookings must be fixed before tightening the constraint';
  END IF;
END $$;
ALTER TABLE public.assignments DROP CONSTRAINT assignments_time_range;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_time_range
  CHECK (planned_end_at > planned_start_at);

CREATE OR REPLACE FUNCTION public.validate_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conflicts jsonb := '[]'::jsonb;
  v_is_admin boolean := COALESCE(public.has_role(auth.uid(), 'admin'), false)
                        OR (auth.uid() IS NULL AND current_user IN ('service_role','postgres','supabase_admin'));
  v_reason text := NULLIF(btrim(COALESCE(NEW.override_reason, '')), '');
BEGIN
  IF NEW.planned_end_at <= NEW.planned_start_at THEN
    RAISE EXCEPTION 'Planned end must be later than planned start';
  END IF;

  IF NEW.assignment_status IN ('planned','confirmed','in_progress') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'kind', 'assignment', 'id', a.id, 'project_id', a.project_id,
             'from', a.planned_start_at, 'to', a.planned_end_at)), '[]'::jsonb)
      INTO v_conflicts
    FROM public.assignments a
    WHERE a.installer_id = NEW.installer_id
      AND a.id <> NEW.id
      AND a.assignment_status IN ('planned','confirmed','in_progress')
      AND tstzrange(a.planned_start_at, a.planned_end_at, '[)')
          && tstzrange(NEW.planned_start_at, NEW.planned_end_at, '[)');

    v_conflicts := v_conflicts || (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'kind', 'absence', 'id', ab.id, 'type', ab.type,
               'from', ab.start_date, 'to', ab.end_date)), '[]'::jsonb)
      FROM public.installer_absences ab
      WHERE ab.installer_id = NEW.installer_id
        AND daterange(ab.start_date, ab.end_date, '[]')
            && daterange(NEW.planned_start_at::date, NEW.planned_end_at::date, '[]')
    );

    IF jsonb_array_length(v_conflicts) > 0 AND v_reason IS NULL THEN
      RAISE EXCEPTION 'Booking conflict for this installer. An admin must supply an override reason.';
    END IF;

    IF v_reason IS NOT NULL AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins may override booking conflicts';
    END IF;
  END IF;

  NEW.override_reason := v_reason;
  RETURN NEW;
END; $function$;

-- 5. Customer visibility for field staff relies only on the typed customer link
CREATE OR REPLACE FUNCTION public.assigned_clients()
RETURNS TABLE(id uuid, ref text, name text, data jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    c.id,
    c.ref,
    c.name,
    jsonb_strip_nulls(jsonb_build_object(
      'id',          COALESCE(c.data->>'id', c.ref),
      'name',        c.name,
      'street',      c.data->>'street',
      'postalCode',  c.data->>'postalCode',
      'region',      c.data->>'region',
      'mainContact', c.data->'mainContact'
    )) AS data
  FROM public.clients c
  JOIN public.projects p ON p.client_id = c.id
  WHERE public.is_project_member(p.id);
$function$;

-- 6. Expand audit coverage to operational records
-- field reports
DROP TRIGGER IF EXISTS trg_audit_field_reports ON public.field_reports;
CREATE TRIGGER trg_audit_field_reports AFTER INSERT OR DELETE ON public.field_reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('field_report', 'project_name');
DROP TRIGGER IF EXISTS trg_audit_field_reports_upd ON public.field_reports;
CREATE TRIGGER trg_audit_field_reports_upd AFTER UPDATE ON public.field_reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('field_report', 'project_name',
    'submitted_at', 'report_text', 'checked_items', 'sign_offs', 'photo_meta', 'photo_paths');

-- deviations
DROP TRIGGER IF EXISTS trg_audit_deviations ON public.deviations;
CREATE TRIGGER trg_audit_deviations AFTER INSERT OR DELETE ON public.deviations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('deviation', 'project_name');
DROP TRIGGER IF EXISTS trg_audit_deviations_upd ON public.deviations;
CREATE TRIGGER trg_audit_deviations_upd AFTER UPDATE ON public.deviations
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('deviation', 'project_name',
    'category', 'severity', 'status', 'description', 'resolved_at', 'resolution_note', 'photo_paths');

-- documents (metadata and scope only — no file contents or signed URLs)
DROP TRIGGER IF EXISTS trg_audit_documents ON public.documents;
CREATE TRIGGER trg_audit_documents AFTER INSERT OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('document', 'title');
DROP TRIGGER IF EXISTS trg_audit_documents_upd ON public.documents;
CREATE TRIGGER trg_audit_documents_upd AFTER UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('document', 'title',
    'title', 'category', 'scope', 'project_id', 'client_id', 'owner_id',
    'visible_to_installers', 'is_sensitive');

-- planned absences
DROP TRIGGER IF EXISTS trg_audit_installer_absences ON public.installer_absences;
CREATE TRIGGER trg_audit_installer_absences AFTER INSERT OR DELETE ON public.installer_absences
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('absence', 'label');
DROP TRIGGER IF EXISTS trg_audit_installer_absences_upd ON public.installer_absences;
CREATE TRIGGER trg_audit_installer_absences_upd AFTER UPDATE ON public.installer_absences
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('absence', 'label',
    'type', 'start_date', 'end_date', 'label', 'installer_id');

-- expense rules
DROP TRIGGER IF EXISTS trg_audit_expense_rules ON public.expense_rules;
CREATE TRIGGER trg_audit_expense_rules AFTER INSERT OR DELETE ON public.expense_rules
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('expense_rule', 'category');
DROP TRIGGER IF EXISTS trg_audit_expense_rules_upd ON public.expense_rules;
CREATE TRIGGER trg_audit_expense_rules_upd AFTER UPDATE ON public.expense_rules
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('expense_rule', 'category',
    'requires_receipt', 'receipt_threshold', 'max_amount');

-- allowed status transitions
DROP TRIGGER IF EXISTS trg_audit_status_transitions ON public.ref_project_status_transition;
CREATE TRIGGER trg_audit_status_transitions AFTER INSERT OR DELETE ON public.ref_project_status_transition
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('status_transition', 'from_status');

-- 7. Log creation of time, mileage and expense entries as well
DROP TRIGGER IF EXISTS trg_audit_time_entries_ins ON public.time_entries;
CREATE TRIGGER trg_audit_time_entries_ins AFTER INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('time_entry', 'snapshot_project_name',
    'entry_date', 'hours', 'start_time', 'end_time', 'hourly_rate', 'project_id', 'installer_id', 'note');
DROP TRIGGER IF EXISTS trg_audit_mileage_entries_ins ON public.mileage_entries;
CREATE TRIGGER trg_audit_mileage_entries_ins AFTER INSERT ON public.mileage_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('mileage_entry', 'snapshot_project_name',
    'entry_date', 'km', 'rate', 'amount', 'project_id', 'installer_id', 'note');
DROP TRIGGER IF EXISTS trg_audit_expense_entries_ins ON public.expense_entries;
CREATE TRIGGER trg_audit_expense_entries_ins AFTER INSERT ON public.expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('expense_entry', 'snapshot_project_name',
    'entry_date', 'amount', 'category', 'entry_kind', 'receipt_path', 'project_id', 'installer_id', 'note');