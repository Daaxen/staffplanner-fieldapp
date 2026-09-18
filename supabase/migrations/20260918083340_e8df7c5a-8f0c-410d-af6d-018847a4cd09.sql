CREATE TABLE public.field_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_ref text NOT NULL,
  installer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  signature text,
  report_text text,
  photo_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (project_ref, installer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_reports TO authenticated;
GRANT ALL ON public.field_reports TO service_role;

ALTER TABLE public.field_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installers manage own field reports" ON public.field_reports
  FOR ALL TO authenticated
  USING (installer_id = auth.uid())
  WITH CHECK (installer_id = auth.uid());

CREATE POLICY "admins read field reports" ON public.field_reports
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_field_reports_updated BEFORE UPDATE ON public.field_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "field photos readable by owner or admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'field-photos' AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "users upload own field photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'field-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "users update own field photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'field-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "users delete own field photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'field-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);