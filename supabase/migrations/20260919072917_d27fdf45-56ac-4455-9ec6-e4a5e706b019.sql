ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS travel_hours numeric NOT NULL DEFAULT 0;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_travel_range CHECK (travel_hours >= 0 AND travel_hours <= 12);

CREATE OR REPLACE FUNCTION public.validate_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time <= NEW.start_time THEN
      RAISE EXCEPTION 'End time must be after start time';
    END IF;
    NEW.hours := round(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2);
  END IF;

  IF NEW.hours IS NULL OR NEW.hours < 0 THEN
    RAISE EXCEPTION 'Hours cannot be negative';
  END IF;
  IF NEW.hours > 16 THEN
    RAISE EXCEPTION 'A single time entry cannot exceed 16 hours';
  END IF;

  NEW.travel_hours := round(coalesce(NEW.travel_hours, 0), 2);
  IF NEW.travel_hours < 0 THEN
    RAISE EXCEPTION 'Travel time cannot be negative';
  END IF;
  IF NEW.travel_hours > 12 THEN
    RAISE EXCEPTION 'Travel time cannot exceed 12 hours';
  END IF;
  IF NEW.hours + NEW.travel_hours > 20 THEN
    RAISE EXCEPTION 'Work time plus travel time cannot exceed 20 hours';
  END IF;

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.capture_job_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_installers uuid[];
  v_hours numeric;
  v_travel numeric;
  v_actual int;
  v_mat numeric;
  v_value numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND NOT EXISTS (SELECT 1 FROM public.job_metrics WHERE project_id = NEW.id) THEN

    SELECT coalesce(array_agg(installer_id), '{}')
      INTO v_installers
      FROM public.project_assignees
     WHERE project_id = NEW.id;

    SELECT coalesce(sum(hours), 0), coalesce(sum(travel_hours), 0), count(DISTINCT installer_id)
      INTO v_hours, v_travel, v_actual
      FROM public.time_entries
     WHERE project_id = NEW.id;

    SELECT coalesce(sum(amount), 0)
      INTO v_mat
      FROM public.expense_entries
     WHERE project_id = NEW.id
       AND category IN ('materials', 'material');

    SELECT pe.fixed_price + pe.additional_revenue
      INTO v_value
      FROM public.project_economy pe
     WHERE pe.project_id = NEW.id;

    IF v_value IS NULL AND NEW.estimated_hours IS NOT NULL AND NEW.hourly_rate IS NOT NULL THEN
      v_value := NEW.estimated_hours * NEW.hourly_rate;
    END IF;

    INSERT INTO public.job_metrics (
      order_id, project_id, customer, city, order_type, category,
      installer_ids, planned_hours, actual_hours, travel_hours,
      planned_installers, actual_installers, planned_date, completed_date,
      material_cost, job_value
    ) VALUES (
      NEW.ref, NEW.id, NEW.client_name, NEW.region, NEW.project_type, NEW.template_id,
      v_installers, NEW.estimated_hours, v_hours, v_travel,
      coalesce(array_length(v_installers, 1), 0), v_actual, NEW.start_date, CURRENT_DATE,
      v_mat, v_value
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.capture_job_metrics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_time_entry() FROM PUBLIC, anon, authenticated;