-- 1. Controlled list of document purposes
CREATE TABLE IF NOT EXISTS public.ref_document_scope (
  code text PRIMARY KEY,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ref_document_scope TO authenticated;
GRANT ALL ON public.ref_document_scope TO service_role;
ALTER TABLE public.ref_document_scope ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_document_scope readable by signed-in users"
  ON public.ref_document_scope FOR SELECT TO authenticated USING (true);
CREATE POLICY "ref_document_scope admin write"
  ON public.ref_document_scope FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.ref_document_scope (code, label, sort_order) VALUES
  ('global_internal',    'Global internal document', 1),
  ('project',            'Project document',         2),
  ('client',             'Client document',          3),
  ('installer_private',  'Installer-private document', 4)
ON CONFLICT (code) DO NOTHING;

-- 2. Ownership fields on documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global_internal',
  ADD COLUMN IF NOT EXISTS visible_to_installers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_scope_fkey,
  ADD CONSTRAINT documents_scope_fkey FOREIGN KEY (scope)
    REFERENCES public.ref_document_scope(code);

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_project_fkey,
  ADD CONSTRAINT documents_project_fkey FOREIGN KEY (project_id)
    REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_client_fkey,
  ADD CONSTRAINT documents_client_fkey FOREIGN KEY (client_id)
    REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_owner_fkey,
  ADD CONSTRAINT documents_owner_fkey FOREIGN KEY (owner_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Ownership must match the declared purpose
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_scope_ownership,
  ADD CONSTRAINT documents_scope_ownership CHECK (
    (scope = 'global_internal'   AND project_id IS NULL AND client_id IS NULL AND owner_id IS NULL)
 OR (scope = 'project'           AND project_id IS NOT NULL AND owner_id IS NULL)
 OR (scope = 'client'            AND client_id IS NOT NULL AND project_id IS NULL AND owner_id IS NULL)
 OR (scope = 'installer_private' AND owner_id IS NOT NULL AND project_id IS NULL AND client_id IS NULL)
  );

-- Only global documents can be published to installers
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_installer_visibility,
  ADD CONSTRAINT documents_installer_visibility CHECK (
    visible_to_installers = false OR scope = 'global_internal'
  );

-- A sensitive document is never published to installers
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_sensitive_not_published,
  ADD CONSTRAINT documents_sensitive_not_published CHECK (
    is_sensitive = false OR visible_to_installers = false
  );

CREATE INDEX IF NOT EXISTS documents_scope_idx ON public.documents (scope);
CREATE INDEX IF NOT EXISTS documents_project_idx ON public.documents (project_id);
CREATE INDEX IF NOT EXISTS documents_client_idx ON public.documents (client_id);
CREATE INDEX IF NOT EXISTS documents_owner_idx ON public.documents (owner_id);

-- 3. Purpose-based access rules (sandbox is no longer an authorization mechanism)
DROP POLICY IF EXISTS "documents read scoped" ON public.documents;
DROP POLICY IF EXISTS "documents admin write" ON public.documents;

CREATE POLICY "documents admin manage all"
  ON public.documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "documents scoped read"
  ON public.documents FOR SELECT TO authenticated
  USING (
    (scope = 'global_internal'
      AND visible_to_installers = true
      AND is_sensitive = false)
    OR (scope = 'project'
      AND project_id IS NOT NULL
      AND public.is_project_member(project_id))
    OR (scope = 'installer_private'
      AND owner_id = auth.uid())
  );

-- Owners manage only their own private documents
CREATE POLICY "documents owner insert private"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (scope = 'installer_private' AND owner_id = auth.uid());

CREATE POLICY "documents owner update private"
  ON public.documents FOR UPDATE TO authenticated
  USING (scope = 'installer_private' AND owner_id = auth.uid())
  WITH CHECK (scope = 'installer_private' AND owner_id = auth.uid());

CREATE POLICY "documents owner delete private"
  ON public.documents FOR DELETE TO authenticated
  USING (scope = 'installer_private' AND owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
REVOKE ALL ON public.documents FROM anon;