CREATE OR REPLACE FUNCTION public.reject_stale_project_save()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_base_updated_at IS NOT NULL
     AND OLD.updated_at > NEW.client_base_updated_at + interval '1 millisecond' THEN
    RAISE EXCEPTION 'STALE_WRITE: work order "%" was changed by someone else. Reload and try again.', OLD.name;
  END IF;
  NEW.client_base_updated_at := NULL;
  RETURN NEW;
END $$;