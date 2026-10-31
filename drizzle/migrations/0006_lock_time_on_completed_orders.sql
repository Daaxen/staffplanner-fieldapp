CREATE OR REPLACE FUNCTION public.reject_time_on_completed_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superuser') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  FOR _pid IN SELECT unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.project_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.project_id END]) LOOP
    IF _pid IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects WHERE id = _pid AND status = 'completed') THEN
      RAISE EXCEPTION 'TIME_LOCKED: Ordern är klar. Kontakta admin om tiden behöver ändras.' USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_time_entries_lock BEFORE INSERT OR UPDATE OR DELETE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.reject_time_on_completed_order();