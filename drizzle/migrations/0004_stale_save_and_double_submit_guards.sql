ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_base_updated_at timestamptz;
COMMENT ON COLUMN public.projects.client_base_updated_at IS 'Write-only: updated_at the client last read; rejects stale saves. Always cleared on write.';

CREATE OR REPLACE FUNCTION public.reject_stale_project_save()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_base_updated_at IS NOT NULL
     AND OLD.updated_at > NEW.client_base_updated_at + interval '1 millisecond' THEN
    RAISE EXCEPTION 'STALE_WRITE: work order "%" was changed by someone else. Reload and try again.', OLD.name
      USING ERRCODE = '40001';
  END IF;
  NEW.client_base_updated_at := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS a_reject_stale_project_save ON public.projects;
CREATE TRIGGER a_reject_stale_project_save BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.reject_stale_project_save();

CREATE OR REPLACE FUNCTION public.reject_duplicate_time_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('time_entry:' || NEW.installer_id::text));
  IF EXISTS (
    SELECT 1 FROM public.time_entries t
    WHERE t.installer_id = NEW.installer_id
      AND t.entry_date = NEW.entry_date
      AND t.project_id IS NOT DISTINCT FROM NEW.project_id
      AND t.client_id IS NOT DISTINCT FROM NEW.client_id
      AND t.activity_type_id IS NOT DISTINCT FROM NEW.activity_type_id
      AND t.hours = NEW.hours
      AND t.travel_hours = NEW.travel_hours
      AND t.start_time IS NOT DISTINCT FROM NEW.start_time
      AND t.end_time IS NOT DISTINCT FROM NEW.end_time
      AND t.description IS NOT DISTINCT FROM NEW.description
      AND t.note IS NOT DISTINCT FROM NEW.note
      AND t.created_at > now() - interval '10 seconds'
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_TIME_ENTRY: this time entry was just saved.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS a_reject_duplicate_time_entry ON public.time_entries;
CREATE TRIGGER a_reject_duplicate_time_entry BEFORE INSERT ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.reject_duplicate_time_entry();