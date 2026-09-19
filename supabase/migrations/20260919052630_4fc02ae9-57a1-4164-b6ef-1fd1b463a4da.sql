CREATE OR REPLACE FUNCTION public.get_employee_private_details(_profile_id uuid, _reason text DEFAULT NULL)
RETURNS public.employee_private_details
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.employee_private_details;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _profile_id <> auth.uid() AND NOT public.has_hr_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only HR may read another employee''s private details';
  END IF;

  SELECT * INTO v_row FROM public.employee_private_details WHERE profile_id = _profile_id;

  INSERT INTO public.employee_private_access_log (profile_id, accessed_by, action, reason)
  VALUES (_profile_id, auth.uid(), 'read', NULLIF(btrim(COALESCE(_reason, '')), ''));

  RETURN v_row;
END; $$;