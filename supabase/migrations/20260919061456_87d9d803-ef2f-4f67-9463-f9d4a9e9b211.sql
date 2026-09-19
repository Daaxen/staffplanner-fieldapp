
-- 1. New document purposes
INSERT INTO public.ref_document_scope (code, label, sort_order, is_approved) VALUES
  ('project_sensitive', 'Sensitive order document', 25, true),
  ('hr', 'HR document', 45, true)
ON CONFLICT (code) DO NOTHING;

-- 2. Move existing sensitive order documents to the new purpose
UPDATE public.documents SET scope = 'project_sensitive'
WHERE scope = 'project' AND is_sensitive = true;

-- 3. Ownership + publication constraints
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_scope_ownership;
ALTER TABLE public.documents ADD CONSTRAINT documents_scope_ownership CHECK (
  (scope = 'global_internal'   AND project_id IS NULL AND client_id IS NULL AND owner_id IS NULL) OR
  (scope = 'hr'                AND project_id IS NULL AND client_id IS NULL) OR
  (scope = 'project'           AND project_id IS NOT NULL AND owner_id IS NULL) OR
  (scope = 'project_sensitive' AND project_id IS NOT NULL AND owner_id IS NULL) OR
  (scope = 'client'            AND client_id IS NOT NULL AND project_id IS NULL AND owner_id IS NULL) OR
  (scope = 'installer_private' AND owner_id IS NOT NULL AND project_id IS NULL AND client_id IS NULL)
);

-- sensitive order documents are always flagged sensitive
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_sensitive_scope;
ALTER TABLE public.documents ADD CONSTRAINT documents_sensitive_scope CHECK (
  scope <> 'project_sensitive' OR is_sensitive = true
);

-- 4. Explicit access grants for sensitive order documents and HR documents
CREATE TABLE IF NOT EXISTS public.document_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  granted_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_access_reason_len CHECK (btrim(reason) <> ''),
  CONSTRAINT document_access_unique UNIQUE (document_id, profile_id)
);
CREATE INDEX IF NOT EXISTS document_access_profile_idx ON public.document_access (profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_access TO authenticated;
GRANT ALL ON public.document_access TO service_role;
ALTER TABLE public.document_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document access admin manage" ON public.document_access;
CREATE POLICY "document access admin manage" ON public.document_access
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "document access read own" ON public.document_access;
CREATE POLICY "document access read own" ON public.document_access
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_document_grant(_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_access
    WHERE document_id = _document_id AND profile_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.has_document_grant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_document_grant(uuid) TO authenticated;

-- 5. Role-based read rules, one branch per document purpose
DROP POLICY IF EXISTS "documents scoped read" ON public.documents;
CREATE POLICY "documents scoped read" ON public.documents
  FOR SELECT TO authenticated
  USING (
    -- internal company material, only when explicitly published and not sensitive
    (scope = 'global_internal' AND visible_to_installers = true AND is_sensitive = false)
    -- ordinary order documents: anyone assigned to that order
    OR (scope = 'project' AND project_id IS NOT NULL AND is_sensitive = false AND public.is_project_member(project_id))
    -- sensitive order documents: assigned AND explicitly granted
    OR (scope = 'project_sensitive' AND project_id IS NOT NULL
        AND public.is_project_member(project_id) AND public.has_document_grant(id))
    -- HR material
    OR (scope = 'hr' AND public.has_hr_access(auth.uid()))
    -- personal documents
    OR (scope = 'installer_private' AND owner_id = auth.uid())
  );

-- HR may manage HR documents
DROP POLICY IF EXISTS "documents hr manage" ON public.documents;
CREATE POLICY "documents hr manage" ON public.documents
  FOR ALL TO authenticated
  USING (scope = 'hr' AND public.has_hr_access(auth.uid()))
  WITH CHECK (scope = 'hr' AND public.has_hr_access(auth.uid()));

-- 6. Audit grants with the existing framework
DROP TRIGGER IF EXISTS trg_audit_document_access ON public.document_access;
CREATE TRIGGER trg_audit_document_access
  AFTER INSERT OR UPDATE OR DELETE ON public.document_access
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
