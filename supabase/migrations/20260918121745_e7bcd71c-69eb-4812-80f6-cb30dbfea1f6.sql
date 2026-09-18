CREATE OR REPLACE FUNCTION public.validate_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflicts jsonb := '[]'::jsonb;
  v_is_admin boolean := COALESCE(public.has_role(auth.uid(), 'admin'), false)
                        OR (auth.uid() IS NULL AND current_user IN ('service_role','postgres','supabase_admin'));
  v_reason text := NULLIF(btrim(COALESCE(NEW.override_reason, '')), '');
BEGIN
  IF NEW.planned_end_at < NEW.planned_start_at THEN
    RAISE EXCEPTION 'Planned end must not be earlier than planned start';
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
END; $$;

REVOKE ALL ON FUNCTION public.validate_assignment() FROM PUBLIC, anon, authenticated;