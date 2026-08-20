
-- Helper: is the caller assigned to a project?
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_assignees pa
    JOIN public.installers i ON i.id = pa.installer_id
    WHERE pa.project_id = _project_id
      AND i.profile_id = auth.uid()
  )
$$;

-- Helper: does the caller share a project with the given installer?
CREATE OR REPLACE FUNCTION public.shares_project_with_installer(_installer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_assignees mine
    JOIN public.installers me ON me.id = mine.installer_id AND me.profile_id = auth.uid()
    JOIN public.project_assignees theirs ON theirs.project_id = mine.project_id
    WHERE theirs.installer_id = _installer_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_project_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shares_project_with_installer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_project_with_installer(uuid) TO authenticated;

-- installers: no more blanket read
DROP POLICY IF EXISTS "installers read" ON public.installers;
CREATE POLICY "installers read scoped" ON public.installers
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR profile_id = auth.uid()
  OR public.shares_project_with_installer(id)
);

-- transport stops: only admins + assigned installers
DROP POLICY IF EXISTS "stops read" ON public.transport_stops;
CREATE POLICY "stops read scoped" ON public.transport_stops
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_project_member(project_id)
);

-- project assignees: only admins + members of the same project
DROP POLICY IF EXISTS "assignees read" ON public.project_assignees;
CREATE POLICY "assignees read scoped" ON public.project_assignees
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_project_member(project_id)
);

-- documents: sandbox/demo content restricted to admins
DROP POLICY IF EXISTS "documents read" ON public.documents;
CREATE POLICY "documents read scoped" ON public.documents
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR sandbox = false
);

-- Internal trigger functions must not be callable through the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;

-- Signed-out visitors get no data access at all
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
