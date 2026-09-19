CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  entity_label text,
  action text NOT NULL CHECK (action IN ('create','update','delete')),
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON public.audit_log (actor_id, created_at DESC);

-- Read-only for admins through the API; writes only happen inside triggers.
REVOKE ALL ON public.audit_log FROM authenticated, anon;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit log admin read" ON public.audit_log;
CREATE POLICY "audit log admin read" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies exist, and this trigger blocks tampering
-- even for roles that bypass RLS through the API.
CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'The audit log is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

-- Generic recorder. TG_ARGV[0] = entity type,
-- TG_ARGV[1] = column holding a human label, TG_ARGV[2..] = tracked columns.
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entity text := TG_ARGV[0];
  v_label_col text := NULLIF(TG_ARGV[1], '');
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_tracked text[] := TG_ARGV[2:array_length(TG_ARGV, 1) - 1];
  v_old_diff jsonb := '{}'::jsonb;
  v_new_diff jsonb := '{}'::jsonb;
  v_id text;
  v_label text;
  v_reason text;
  c text;
BEGIN
  v_id := COALESCE(v_new->>'id', v_old->>'id', v_new->>'project_id', v_old->>'project_id', '');
  IF v_label_col IS NOT NULL THEN
    v_label := COALESCE(v_new->>v_label_col, v_old->>v_label_col);
  END IF;
  v_reason := COALESCE(v_new->>'override_reason', v_new->>'reason', v_new->>'note');

  IF TG_OP = 'UPDATE' THEN
    IF array_length(v_tracked, 1) IS NULL THEN
      v_tracked := ARRAY(SELECT jsonb_object_keys(v_new));
    END IF;
    FOREACH c IN ARRAY v_tracked LOOP
      IF v_old->c IS DISTINCT FROM v_new->c THEN
        v_old_diff := v_old_diff || jsonb_build_object(c, v_old->c);
        v_new_diff := v_new_diff || jsonb_build_object(c, v_new->c);
      END IF;
    END LOOP;
    IF v_old_diff = '{}'::jsonb THEN
      RETURN NULL; -- nothing we care about changed
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_new_diff := v_new;
  ELSE
    v_old_diff := v_old;
  END IF;

  INSERT INTO public.audit_log (actor_id, entity_type, entity_id, entity_label, action,
                                old_values, new_values, reason)
  VALUES (auth.uid(), v_entity, v_id, v_label,
          lower(CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END),
          NULLIF(v_old_diff, '{}'::jsonb), NULLIF(v_new_diff, '{}'::jsonb), v_reason);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_log_immutable() FROM PUBLIC, anon, authenticated;

-- Orders: creation, deletion, status, dates, customer, rates
DROP TRIGGER IF EXISTS trg_audit_projects ON public.projects;
CREATE TRIGGER trg_audit_projects
  AFTER INSERT OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('project', 'name');
DROP TRIGGER IF EXISTS trg_audit_projects_upd ON public.projects;
CREATE TRIGGER trg_audit_projects_upd
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'project', 'name', 'status', 'start_date', 'end_date', 'client_id', 'client_ref',
    'client_name', 'hourly_rate', 'mileage_rate', 'location', 'project_type', 'name');

-- Customers: commercial and invoicing changes
DROP TRIGGER IF EXISTS trg_audit_clients ON public.clients;
CREATE TRIGGER trg_audit_clients
  AFTER INSERT OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('client', 'name');
DROP TRIGGER IF EXISTS trg_audit_clients_upd ON public.clients;
CREATE TRIGGER trg_audit_clients_upd
  AFTER UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'client', 'name', 'name', 'hourly_rate', 'overtime_rate', 'mileage_rate', 'vat_percent',
    'invoice_email', 'payment_terms_days', 'org_number', 'vat_number');

-- Staff assignment to orders
DROP TRIGGER IF EXISTS trg_audit_project_assignees ON public.project_assignees;
CREATE TRIGGER trg_audit_project_assignees
  AFTER INSERT OR DELETE ON public.project_assignees
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('assignment', '');

-- Bookings, including admin overrides (reason is captured)
DROP TRIGGER IF EXISTS trg_audit_assignments ON public.assignments;
CREATE TRIGGER trg_audit_assignments
  AFTER INSERT OR DELETE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('booking', '');
DROP TRIGGER IF EXISTS trg_audit_assignments_upd ON public.assignments;
CREATE TRIGGER trg_audit_assignments_upd
  AFTER UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'booking', '', 'installer_id', 'planned_start_at', 'planned_end_at',
    'assignment_status', 'override_reason');

-- Reporting corrections
DROP TRIGGER IF EXISTS trg_audit_time_entries ON public.time_entries;
CREATE TRIGGER trg_audit_time_entries
  AFTER UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'time_entry', 'snapshot_project_name', 'entry_date', 'hours', 'start_time', 'end_time',
    'hourly_rate', 'project_id', 'installer_id', 'note');

DROP TRIGGER IF EXISTS trg_audit_mileage_entries ON public.mileage_entries;
CREATE TRIGGER trg_audit_mileage_entries
  AFTER UPDATE OR DELETE ON public.mileage_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'mileage_entry', 'snapshot_project_name', 'entry_date', 'km', 'rate', 'amount',
    'project_id', 'installer_id', 'note');

DROP TRIGGER IF EXISTS trg_audit_expense_entries ON public.expense_entries;
CREATE TRIGGER trg_audit_expense_entries
  AFTER UPDATE OR DELETE ON public.expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'expense_entry', 'snapshot_project_name', 'entry_date', 'amount', 'category',
    'entry_kind', 'receipt_path', 'project_id', 'installer_id', 'note');

-- Order economy / price overrides
DROP TRIGGER IF EXISTS trg_audit_project_economy ON public.project_economy;
CREATE TRIGGER trg_audit_project_economy
  AFTER INSERT OR UPDATE OR DELETE ON public.project_economy
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('project_economy', '');

-- Staff records
DROP TRIGGER IF EXISTS trg_audit_installers ON public.installers;
CREATE TRIGGER trg_audit_installers
  AFTER INSERT OR DELETE ON public.installers
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('installer', 'name');
DROP TRIGGER IF EXISTS trg_audit_installers_upd ON public.installers;
CREATE TRIGGER trg_audit_installers_upd
  AFTER UPDATE ON public.installers
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
    'installer', 'name', 'name', 'type', 'profile_id', 'base_location', 'color');

-- Role changes
DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('user_role', '');