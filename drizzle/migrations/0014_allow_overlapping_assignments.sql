ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_no_overlap;

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
  -- Overlapping work orders for the same installer are allowed; only absences block.
  IF NEW.assignment_status IN ('planned','confirmed','in_progress') THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('kind','absence','id',ab.id,'type',ab.type,
             'name',COALESCE(ab.label, ab.type),'from',ab.start_date,'to',ab.end_date)), '[]'::jsonb)
      INTO v_conflicts
    FROM public.installer_absences ab
    WHERE ab.installer_id = NEW.installer_id
      AND daterange(ab.start_date, ab.end_date, '[]') && daterange(NEW.planned_start_at::date, NEW.planned_end_at::date, '[]');
    IF jsonb_array_length(v_conflicts) > 0 AND v_reason IS NULL THEN
      SELECT name INTO v_inst FROM public.installers WHERE id = NEW.installer_id;
      SELECT string_agg('frånvaro (' || (c->>'name') || ') ' || to_char((c->>'from')::date,'DD/MM') || '–' || to_char((c->>'to')::date,'DD/MM'), '; ')
        INTO v_msg FROM jsonb_array_elements(v_conflicts) c;
      RAISE EXCEPTION 'Bokningskrock: % – %. En admin måste ange skäl för att boka ändå.', COALESCE(v_inst,'Montören'), v_msg;
    END IF;
    IF v_reason IS NOT NULL AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins may override booking conflicts';
    END IF;
  END IF;
  NEW.override_reason := v_reason;
  RETURN NEW;
END; $function$;