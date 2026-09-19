-- 1. Portal membership
CREATE TABLE IF NOT EXISTS public.customer_portal_users (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_portal_users TO authenticated;
GRANT ALL ON public.customer_portal_users TO service_role;
ALTER TABLE public.customer_portal_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal membership admins manage" ON public.customer_portal_users
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "portal membership read own" ON public.customer_portal_users
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

GRANT INSERT, UPDATE, DELETE ON public.customer_portal_users TO authenticated;

CREATE TRIGGER trg_customer_portal_users_updated
  BEFORE UPDATE ON public.customer_portal_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS customer_portal_users_client_idx
  ON public.customer_portal_users (client_id);

-- 2. Helpers
CREATE OR REPLACE FUNCTION public.my_portal_client_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.customer_portal_users WHERE profile_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.portal_can_view_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND p.client_id IS NOT NULL
      AND p.client_id = public.my_portal_client_id()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.my_portal_client_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.portal_can_view_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_portal_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_can_view_project(uuid) TO authenticated;

-- 3. Read-only visibility for portal customers
CREATE POLICY "portal customers read own projects" ON public.projects
  FOR SELECT TO authenticated
  USING (client_id IS NOT NULL AND client_id = public.my_portal_client_id());

CREATE POLICY "portal customers read own assignees" ON public.project_assignees
  FOR SELECT TO authenticated
  USING (public.portal_can_view_project(project_id));

CREATE POLICY "portal customers read assigned installers" ON public.installers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_assignees pa
    WHERE pa.installer_id = installers.id
      AND public.portal_can_view_project(pa.project_id)
  ));

CREATE POLICY "portal customers read own field reports" ON public.field_reports
  FOR SELECT TO authenticated
  USING (public.portal_can_view_project(project_id));

CREATE POLICY "portal customers read own deviations" ON public.deviations
  FOR SELECT TO authenticated
  USING (public.portal_can_view_project(project_id));

CREATE POLICY "portal customers read own status history" ON public.project_status_events
  FOR SELECT TO authenticated
  USING (public.portal_can_view_project(project_id));

-- Photos attached to those reports / deviations
CREATE POLICY "portal customers read own field photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'field-photos'
    AND (
      EXISTS (
        SELECT 1 FROM public.field_reports fr
        WHERE fr.photo_paths ? storage.objects.name
          AND public.portal_can_view_project(fr.project_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.deviations d
        WHERE d.photo_paths ? storage.objects.name
          AND public.portal_can_view_project(d.project_id)
      )
    )
  );

-- 4. Immutable portal activity log
CREATE TABLE IF NOT EXISTS public.customer_portal_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid,
  client_id uuid,
  entity_type text NOT NULL,
  entity_id text,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_portal_access_log TO authenticated;
GRANT ALL ON public.customer_portal_access_log TO service_role;
ALTER TABLE public.customer_portal_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal log admins read" ON public.customer_portal_access_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_customer_portal_log_immutable
  BEFORE UPDATE OR DELETE ON public.customer_portal_access_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

CREATE INDEX IF NOT EXISTS customer_portal_log_client_idx
  ON public.customer_portal_access_log (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_portal_log_profile_idx
  ON public.customer_portal_access_log (profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_portal_access(
  _entity_type text,
  _action text,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_client uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_client := public.my_portal_client_id();
  IF v_client IS NULL THEN RAISE EXCEPTION 'Not a portal user'; END IF;

  INSERT INTO public.customer_portal_access_log
    (profile_id, client_id, entity_type, entity_id, action, metadata)
  VALUES (auth.uid(), v_client, left(COALESCE(_entity_type, 'unknown'), 60),
          left(COALESCE(_entity_id, ''), 100), left(COALESCE(_action, 'view'), 40),
          COALESCE(_metadata, '{}'::jsonb));
END; $$;

REVOKE EXECUTE ON FUNCTION public.log_portal_access(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_portal_access(text, text, text, jsonb) TO authenticated;