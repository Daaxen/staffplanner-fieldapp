CREATE TABLE public.work_order_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  installer_id uuid NOT NULL REFERENCES public.installers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_order_links_project_idx ON public.work_order_links(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_links TO authenticated;
GRANT ALL ON public.work_order_links TO service_role;
ALTER TABLE public.work_order_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage work order links" ON public.work_order_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.expire_links_on_complete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    UPDATE public.work_order_links SET expires_at = LEAST(coalesce(expires_at, now() + interval '5 days'), now() + interval '5 days')
      WHERE project_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER projects_expire_links AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.expire_links_on_complete();