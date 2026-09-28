-- Uploaded-file support for documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS storage_path text;

-- Storage policies for the private "documents" bucket.
-- Object path convention: "{auth.uid()}/{documentId}/{filename}".

DROP POLICY IF EXISTS "documents bucket read" ON storage.objects;
CREATE POLICY "documents bucket read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.storage_path = objects.name
          AND (
            (d.scope = 'global_internal' AND d.visible_to_installers = true AND d.is_sensitive = false)
            OR (d.scope = 'project' AND d.project_id IS NOT NULL AND d.is_sensitive = false
                AND public.is_project_member(d.project_id))
            OR (d.scope = 'project_sensitive' AND d.project_id IS NOT NULL
                AND public.is_project_member(d.project_id) AND public.has_document_grant(d.id))
            OR (d.scope = 'hr' AND public.has_hr_access(auth.uid()))
            OR (d.scope = 'installer_private' AND d.owner_id = auth.uid())
          )
      )
    )
  );

DROP POLICY IF EXISTS "documents bucket upload" ON storage.objects;
CREATE POLICY "documents bucket upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND name LIKE (auth.uid()::text || '/%')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  );

DROP POLICY IF EXISTS "documents bucket update" ON storage.objects;
CREATE POLICY "documents bucket update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND name LIKE (auth.uid()::text || '/%')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND name LIKE (auth.uid()::text || '/%')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  );

DROP POLICY IF EXISTS "documents bucket delete" ON storage.objects;
CREATE POLICY "documents bucket delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND name LIKE (auth.uid()::text || '/%')
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'hr'))
  );