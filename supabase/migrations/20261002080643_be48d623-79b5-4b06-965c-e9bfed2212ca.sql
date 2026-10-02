CREATE OR REPLACE FUNCTION public.validate_assignment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_conflicts jsonb := '[]'::jsonb;
  v_is_admin boolean := COALESCE(public.has_role(auth.uid(), 'admin'), false)
                        OR (auth.uid() IS NULL AND current_user IN ('service_role','postgres','supabase_admin'));
  v_reason text := NULLIF(btrim(COALESCE(NEW.override_reason, '')), '');
  v_inst text; v_msg text;
BEGIN
  IF NEW.planned_end_at <= NEW.planned_start_at THEN
    RAISE EXCEPTION 'Planned end must be later than planned start';
  END IF;
  IF NEW.assignment_status IN ('planned','confirmed','in_progress') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('kind','assignment','id',a.id,'project_id',a.project_id,
             'name',p.name,'from',a.planned_start_at,'to',a.planned_end_at)), '[]'::jsonb)
      INTO v_conflicts
    FROM public.assignments a LEFT JOIN public.projects p ON p.id = a.project_id
    WHERE a.installer_id = NEW.installer_id AND a.id <> NEW.id
      AND a.assignment_status IN ('planned','confirmed','in_progress')
      AND tstzrange(a.planned_start_at, a.planned_end_at, '[)') && tstzrange(NEW.planned_start_at, NEW.planned_end_at, '[)');
    v_conflicts := v_conflicts || (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('kind','absence','id',ab.id,'type',ab.type,
               'name',COALESCE(ab.label, ab.type),'from',ab.start_date,'to',ab.end_date)), '[]'::jsonb)
      FROM public.installer_absences ab
      WHERE ab.installer_id = NEW.installer_id
        AND daterange(ab.start_date, ab.end_date, '[]') && daterange(NEW.planned_start_at::date, NEW.planned_end_at::date, '[]'));
    IF jsonb_array_length(v_conflicts) > 0 AND v_reason IS NULL THEN
      SELECT name INTO v_inst FROM public.installers WHERE id = NEW.installer_id;
      SELECT string_agg(
        CASE WHEN c->>'kind' = 'absence'
          THEN 'frånvaro (' || (c->>'name') || ') ' || to_char((c->>'from')::date,'DD/MM') || '–' || to_char((c->>'to')::date,'DD/MM')
          ELSE 'redan bokad på ' || COALESCE(c->>'name','annan order') || ' ' ||
               to_char(((c->>'from')::timestamptz) AT TIME ZONE 'Europe/Stockholm','DD/MM HH24:MI') || '–' ||
               to_char(((c->>'to')::timestamptz) AT TIME ZONE 'Europe/Stockholm','DD/MM HH24:MI')
        END, '; ') INTO v_msg FROM jsonb_array_elements(v_conflicts) c;
      RAISE EXCEPTION 'Bokningskrock: % – %. En admin måste ange skäl för att boka ändå.', COALESCE(v_inst,'Montören'), v_msg;
    END IF;
    IF v_reason IS NOT NULL AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins may override booking conflicts';
    END IF;
  END IF;
  NEW.override_reason := v_reason;
  RETURN NEW;
END; $function$;