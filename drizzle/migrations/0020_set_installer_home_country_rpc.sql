CREATE OR REPLACE FUNCTION public.set_installer_home_country(_installer_id uuid, _country text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser') OR public.has_role(auth.uid(),'hr')) THEN
    RAISE EXCEPTION 'Endast admin eller HR kan ändra hemland' USING ERRCODE = '42501';
  END IF;
  IF _country IS NOT NULL AND _country !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Hemland måste vara en tvåställig landskod';
  END IF;
  UPDATE public.installers SET home_country = _country WHERE id = _installer_id;
END $$;
REVOKE ALL ON FUNCTION public.set_installer_home_country(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_installer_home_country(uuid, text) TO authenticated;