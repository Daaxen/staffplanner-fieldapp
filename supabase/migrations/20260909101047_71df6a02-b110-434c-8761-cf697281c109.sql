ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ref text,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS clients_ref_key ON public.clients (ref) WHERE ref IS NOT NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ref text,
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS projects_ref_key ON public.projects (ref) WHERE ref IS NOT NULL;

DROP POLICY IF EXISTS "clients read for signed-in users" ON public.clients;
CREATE POLICY "clients read for signed-in users"
ON public.clients FOR SELECT TO authenticated
USING (true);