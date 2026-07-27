
-- ============ PROFILES: tighten RLS ============
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "admins insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins delete profiles" ON public.profiles;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sandbox_mode boolean NOT NULL DEFAULT false;

CREATE POLICY "profiles self or admin read" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles self or admin update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles admin insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = auth.uid());

CREATE POLICY "profiles admin delete" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ CLIENTS ============
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients read" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients admin write" ON public.clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INSTALLERS ============
CREATE TABLE public.installers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color integer NOT NULL DEFAULT 1,
  type text NOT NULL DEFAULT 'own',
  base_location text,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installers TO authenticated;
GRANT ALL ON public.installers TO service_role;
ALTER TABLE public.installers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installers read" ON public.installers FOR SELECT TO authenticated USING (true);
CREATE POLICY "installers admin write" ON public.installers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_installers_updated BEFORE UPDATE ON public.installers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROJECTS ============
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_type text NOT NULL DEFAULT 'installation',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  location text,
  status text NOT NULL DEFAULT 'open',
  start_date date,
  end_date date,
  contact_name text,
  contact_phone text,
  contact_email text,
  sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects read" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects admin write" ON public.projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROJECT ASSIGNEES ============
CREATE TABLE public.project_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  installer_id uuid NOT NULL REFERENCES public.installers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, installer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_assignees TO authenticated;
GRANT ALL ON public.project_assignees TO service_role;
ALTER TABLE public.project_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignees read" ON public.project_assignees FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignees admin write" ON public.project_assignees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ INSTALLER ABSENCES ============
CREATE TABLE public.installer_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id uuid NOT NULL REFERENCES public.installers(id) ON DELETE CASCADE,
  type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  label text,
  sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installer_absences TO authenticated;
GRANT ALL ON public.installer_absences TO service_role;
ALTER TABLE public.installer_absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "absences read" ON public.installer_absences FOR SELECT TO authenticated USING (true);
CREATE POLICY "absences admin write" ON public.installer_absences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ TRANSPORT STOPS ============
CREATE TABLE public.transport_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  address text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_stops TO authenticated;
GRANT ALL ON public.transport_stops TO service_role;
ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stops read" ON public.transport_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "stops admin write" ON public.transport_stops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ DOCUMENTS ============
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  description text,
  url text,
  file_type text,
  sandbox boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents read" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents admin write" ON public.documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
