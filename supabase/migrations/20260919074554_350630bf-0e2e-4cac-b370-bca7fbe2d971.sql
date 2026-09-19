-- 1. Backfill: exact customer reference match
UPDATE public.projects p
SET client_id = c.id
FROM public.clients c
WHERE p.client_id IS NULL
  AND p.client_ref IS NOT NULL
  AND c.ref = p.client_ref;

-- 2. Backfill: unambiguous name match only (never guess between several customers)
UPDATE public.projects p
SET client_id = m.id
FROM (
  SELECT lower(btrim(name)) AS key, min(id::text)::uuid AS id, count(*) AS n
  FROM public.clients
  WHERE name IS NOT NULL AND btrim(name) <> ''
  GROUP BY 1
) m
WHERE p.client_id IS NULL
  AND m.n = 1
  AND p.client_name IS NOT NULL
  AND lower(btrim(p.client_name)) = m.key;

-- 3. Report orders that still could not be linked (admin-only table)
INSERT INTO public.reporting_migration_unmatched (table_name, row_id, raw_project_id)
SELECT 'projects.client_id', p.id, COALESCE(p.client_ref, p.client_name)
FROM public.projects p
WHERE p.client_id IS NULL
  AND (p.client_ref IS NOT NULL OR (p.client_name IS NOT NULL AND btrim(p.client_name) <> ''))
  AND NOT EXISTS (
    SELECT 1 FROM public.reporting_migration_unmatched u
    WHERE u.table_name = 'projects.client_id' AND u.row_id = p.id
  );

-- 4. Keep the link correct for every insert/update, whatever the entry point
CREATE OR REPLACE FUNCTION public.resolve_project_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_n  int;
BEGIN
  IF NEW.client_ref IS NOT NULL THEN
    SELECT c.id INTO v_id FROM public.clients c WHERE c.ref = NEW.client_ref;
    IF v_id IS NOT NULL THEN
      NEW.client_id := v_id;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.client_id IS NULL AND NEW.client_name IS NOT NULL AND btrim(NEW.client_name) <> '' THEN
    SELECT count(*), min(c.id::text)::uuid INTO v_n, v_id
    FROM public.clients c
    WHERE lower(btrim(c.name)) = lower(btrim(NEW.client_name));
    IF v_n = 1 THEN
      NEW.client_id := v_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_project_client() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_resolve_project_client ON public.projects;
CREATE TRIGGER trg_resolve_project_client
BEFORE INSERT OR UPDATE OF client_ref, client_name, client_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.resolve_project_client();

-- 5. Field staff need address and site contact, never commercial data
DROP FUNCTION IF EXISTS public.assigned_clients();
CREATE FUNCTION public.assigned_clients()
RETURNS TABLE(
  id uuid,
  ref text,
  name text,
  customer_number text,
  street text,
  postal_code text,
  region text,
  contact_name text,
  contact_role text,
  contact_phone text,
  contact_email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    c.id, c.ref, c.name, c.customer_number,
    c.street, c.postal_code, c.region,
    c.contact_name, c.contact_role, c.contact_phone, c.contact_email
  FROM public.clients c
  JOIN public.projects p ON p.client_id = c.id
  WHERE public.is_project_member(p.id);
$$;

REVOKE ALL ON FUNCTION public.assigned_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assigned_clients() TO authenticated;

CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects (client_id);