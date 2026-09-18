DROP POLICY IF EXISTS "clients read for signed-in users" ON public.clients;

CREATE OR REPLACE FUNCTION public.assigned_clients()
RETURNS TABLE (id uuid, ref text, name text, data jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    c.id,
    c.ref,
    c.name,
    jsonb_strip_nulls(jsonb_build_object(
      'id',          COALESCE(c.data->>'id', c.ref),
      'name',        c.name,
      'street',      c.data->>'street',
      'postalCode',  c.data->>'postalCode',
      'region',      c.data->>'region',
      'mainContact', c.data->'mainContact'
    )) AS data
  FROM public.clients c
  JOIN public.projects p
    ON p.client_id = c.id
    OR lower(COALESCE(p.data->>'client', p.name)) = lower(c.name)
  WHERE public.is_project_member(p.id);
$function$;

REVOKE ALL ON FUNCTION public.assigned_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assigned_clients() TO authenticated;