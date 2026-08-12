
DROP POLICY IF EXISTS "avatars readable by authenticated" ON storage.objects;

CREATE POLICY "avatars readable by owner or admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
