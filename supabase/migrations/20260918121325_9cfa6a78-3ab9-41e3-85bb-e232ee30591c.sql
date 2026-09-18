CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  installer_id uuid NOT NULL REFERENCES public.installers(id) ON DELETE RESTRICT,
  planned_start_at timestamptz NOT NULL,
  planned_end_at timestamptz NOT NULL,
  assignment_status text NOT NULL DEFAULT 'planned',
  override_reason text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignments_time_range CHECK (planned_end_at >= planned_start_at),
  CONSTRAINT assignments_status_valid CHECK (
    assignment_status IN ('planned','confirmed','in_progress','completed','cancelled')
  ),
  CONSTRAINT assignments_override_reason_len CHECK (
    override_reason IS NULL OR length(btrim(override_reason)) >= 10
  )
);

COMMENT ON TABLE public.assignments IS
  'Authoritative scheduling/booking source. project_assignees stays the membership/RLS source.';

-- No overlapping active bookings for the same installer, unless explicitly overridden with a reason.
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_no_overlap EXCLUDE USING gist (
    installer_id WITH =,
    tstzrange(planned_start_at, planned_end_at, '[)') WITH &&
  ) WHERE (assignment_status IN ('planned','confirmed','in_progress') AND override_reason IS NULL);

CREATE INDEX assignments_project_idx ON public.assignments (project_id);
CREATE INDEX assignments_installer_idx ON public.assignments (installer_id, planned_start_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage assignments" ON public.assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "installers read own assignments" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.installers i
             WHERE i.id = assignments.installer_id AND i.profile_id = auth.uid())
    OR public.is_project_member(assignments.project_id)
  );

-- Audit log for overridden conflicts
CREATE TABLE public.assignment_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  project_id uuid,
  installer_id uuid,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  reason text NOT NULL,
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.assignment_overrides TO authenticated;
GRANT ALL ON public.assignment_overrides TO service_role;
ALTER TABLE public.assignment_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read assignment overrides" ON public.assignment_overrides
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation: absence overlap, override rules, audit logging, membership sync
CREATE OR REPLACE FUNCTION public.validate_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflicts jsonb := '[]'::jsonb;
  v_is_admin boolean := public.has_role(auth.uid(), 'admin');
  v_reason text := NULLIF(btrim(COALESCE(NEW.override_reason, '')), '');
BEGIN
  IF NEW.planned_end_at < NEW.planned_start_at THEN
    RAISE EXCEPTION 'Planned end must not be earlier than planned start';
  END IF;

  IF NEW.assignment_status IN ('planned','confirmed','in_progress') THEN
    -- overlapping active bookings (informational; the exclusion constraint blocks non-overridden ones)
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

    -- overlapping registered absences
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
END; $$;

CREATE OR REPLACE FUNCTION public.log_assignment_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflicts jsonb;
BEGIN
  IF NULLIF(btrim(COALESCE(NEW.override_reason, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.override_reason, '') = COALESCE(NEW.override_reason, '')
     AND OLD.planned_start_at = NEW.planned_start_at
     AND OLD.planned_end_at = NEW.planned_end_at THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) INTO v_conflicts FROM (
    SELECT jsonb_build_object('kind','assignment','id',a.id,'project_id',a.project_id,
                              'from',a.planned_start_at,'to',a.planned_end_at) AS c
    FROM public.assignments a
    WHERE a.installer_id = NEW.installer_id AND a.id <> NEW.id
      AND a.assignment_status IN ('planned','confirmed','in_progress')
      AND tstzrange(a.planned_start_at, a.planned_end_at, '[)')
          && tstzrange(NEW.planned_start_at, NEW.planned_end_at, '[)')
    UNION ALL
    SELECT jsonb_build_object('kind','absence','id',ab.id,'type',ab.type,
                              'from',ab.start_date,'to',ab.end_date)
    FROM public.installer_absences ab
    WHERE ab.installer_id = NEW.installer_id
      AND daterange(ab.start_date, ab.end_date, '[]')
          && daterange(NEW.planned_start_at::date, NEW.planned_end_at::date, '[]')
  ) s;

  INSERT INTO public.assignment_overrides (
    assignment_id, project_id, installer_id, planned_start_at, planned_end_at,
    reason, conflicts, created_by)
  VALUES (NEW.id, NEW.project_id, NEW.installer_id, NEW.planned_start_at, NEW.planned_end_at,
          NEW.override_reason, v_conflicts, COALESCE(NEW.created_by, auth.uid()));

  RETURN NEW;
END; $$;

-- keep project membership (and therefore RLS access) in sync with bookings
CREATE OR REPLACE FUNCTION public.sync_assignment_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_assignees (project_id, installer_id)
  VALUES (NEW.project_id, NEW.installer_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_assignments_validate
  BEFORE INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_assignment();

CREATE TRIGGER trg_assignments_override_log
  AFTER INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_assignment_override();

CREATE TRIGGER trg_assignments_membership
  AFTER INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_membership();

REVOKE ALL ON FUNCTION public.validate_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_assignment_override() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_assignment_membership() FROM PUBLIC, anon, authenticated;