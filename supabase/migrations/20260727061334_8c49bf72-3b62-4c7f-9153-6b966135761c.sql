ALTER TABLE public.reminders
  ALTER COLUMN project_id TYPE uuid USING project_id::uuid;
ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;