DROP POLICY IF EXISTS "installers update own record" ON public.installers;

REVOKE UPDATE ON public.installers FROM authenticated;
GRANT SELECT ON public.installers TO authenticated;
GRANT ALL ON public.installers TO service_role;

CREATE OR REPLACE FUNCTION public.installer_update_self(_base_location text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_location text;
  v_rows int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_base_location := NULLIF(btrim(COALESCE(_base_location, '')), '');
  IF v_base_location IS NOT NULL AND length(v_base_location) > 200 THEN
    RAISE EXCEPTION 'Base location must be 200 characters or less';
  END IF;

  -- Only self-service fields may be written here. Name, color, type,
  -- profile_id and sandbox stay admin-managed.
  UPDATE public.installers
     SET base_location = v_base_location
   WHERE profile_id = auth.uid();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'No installer record for the current user';
  END IF;
END; $function$;

REVOKE ALL ON FUNCTION public.installer_update_self(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.installer_update_self(text) TO authenticated;