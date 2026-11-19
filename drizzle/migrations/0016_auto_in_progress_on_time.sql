CREATE OR REPLACE FUNCTION public.start_project_on_time_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_status text;
BEGIN
  IF NEW.project_id IS NULL OR coalesce(NEW.hours,0) + coalesce(NEW.travel_hours,0) <= 0 THEN RETURN NULL; END IF;
  SELECT status INTO v_status FROM public.projects WHERE id = NEW.project_id FOR UPDATE;
  IF v_status NOT IN ('open','scheduled') THEN RETURN NULL; END IF;
  PERFORM set_config('app.actor_type', 'system', true);
  PERFORM set_config('app.actor_name', 'Automatiskt: tid loggad', true);
  IF v_status = 'open' THEN
    UPDATE public.projects SET status = 'scheduled' WHERE id = NEW.project_id;
  END IF;
  UPDATE public.projects SET status = 'in-progress' WHERE id = NEW.project_id;
  PERFORM set_config('app.actor_type', '', true);
  PERFORM set_config('app.actor_name', '', true);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_time_entry_starts_project ON public.time_entries;
CREATE TRIGGER trg_time_entry_starts_project AFTER INSERT ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.start_project_on_time_entry();