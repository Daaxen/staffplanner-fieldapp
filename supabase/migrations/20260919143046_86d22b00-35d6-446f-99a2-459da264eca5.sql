CREATE TABLE public.project_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_number text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  description text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_groups TO authenticated;
GRANT ALL ON public.project_groups TO service_role;

ALTER TABLE public.project_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects
  ADD COLUMN project_group_id uuid REFERENCES public.project_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_project_group_id ON public.projects(project_group_id);
CREATE INDEX idx_project_groups_client_id ON public.project_groups(client_id);

CREATE POLICY "Admins and HR manage projects"
ON public.project_groups FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'));

CREATE POLICY "Members read their project"
ON public.project_groups FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.project_group_id = project_groups.id
    AND public.is_project_member(p.id)
));

CREATE TRIGGER update_project_groups_updated_at
BEFORE UPDATE ON public.project_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();