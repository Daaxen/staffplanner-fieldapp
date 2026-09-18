ALTER TABLE public.projects
  ADD CONSTRAINT projects_date_range CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date >= start_date
  );

ALTER TABLE public.installer_absences
  ADD CONSTRAINT installer_absences_date_range CHECK (end_date >= start_date);