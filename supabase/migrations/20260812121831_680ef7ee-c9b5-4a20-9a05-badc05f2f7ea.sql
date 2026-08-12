
-- 1. Clients: admin only
DROP POLICY IF EXISTS "clients read" ON public.clients;
CREATE POLICY "clients admin read" ON public.clients
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Projects: admin + assigned installer
DROP POLICY IF EXISTS "projects read" ON public.projects;
CREATE POLICY "projects read assigned or admin" ON public.projects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.project_assignees pa
      JOIN public.installers i ON i.id = pa.installer_id
      WHERE pa.project_id = projects.id
        AND i.profile_id = auth.uid()
    )
  );

-- 3. Absences: admin + self
DROP POLICY IF EXISTS "absences read" ON public.installer_absences;
CREATE POLICY "absences read own or admin" ON public.installer_absences
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.installers i
      WHERE i.id = installer_absences.installer_id
        AND i.profile_id = auth.uid()
    )
  );
