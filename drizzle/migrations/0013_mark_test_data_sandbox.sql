UPDATE public.installers SET sandbox = true WHERE name ILIKE 'TEST %';
UPDATE public.projects SET sandbox = true WHERE project_number ILIKE 'TEST-%' OR name ILIKE 'TEST %' OR name ILIKE 'TEST-%' OR name ILIKE 'TEST –%';
UPDATE public.clients SET sandbox = true WHERE name ILIKE 'TEST %' OR name ILIKE 'TEST –%' OR customer_number ILIKE 'TEST-%';

-- Anything created by a test account, or tagged TEST-, is test data automatically.
CREATE OR REPLACE FUNCTION public.mark_test_data()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tagged boolean := false; j jsonb := to_jsonb(NEW);
BEGIN
  IF COALESCE(j->>'project_number', j->>'customer_number', '') ILIKE 'TEST-%'
     OR COALESCE(j->>'name','') ~* '^TEST[ \-–]' THEN tagged := true; END IF;
  IF NOT tagged AND auth.uid() IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.installers WHERE profile_id = auth.uid() AND sandbox) INTO tagged;
  END IF;
  IF tagged THEN NEW.sandbox := true; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_mark_test_project ON public.projects;
CREATE TRIGGER trg_mark_test_project BEFORE INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.mark_test_data();
DROP TRIGGER IF EXISTS trg_mark_test_client ON public.clients;
CREATE TRIGGER trg_mark_test_client BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.mark_test_data();