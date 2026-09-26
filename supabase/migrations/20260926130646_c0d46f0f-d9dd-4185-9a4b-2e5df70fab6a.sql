CREATE TABLE public.time_activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_activity_types TO authenticated;
GRANT ALL ON public.time_activity_types TO service_role;
ALTER TABLE public.time_activity_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity types read" ON public.time_activity_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity types admin" ON public.time_activity_types FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_time_activity_types_updated BEFORE UPDATE ON public.time_activity_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.time_activity_types(name, sort_order) VALUES
('Projektkoordinering',1),('Projektledning',2),('Planering',3),('Installation',4),('Montage',5),
('Service',6),('Felsökning',7),('Materialberedning',8),('Lagerarbete',9),('Lagerunderhåll',10),
('Verktygsunderhåll',11),('Fordonsunderhåll',12),('Materialinventering',13),('Resa',14),
('Utbildning',15),('Intern administration',16),('Övrigt',17);

ALTER TABLE public.time_entries
  ALTER COLUMN project_id DROP NOT NULL,
  ADD COLUMN client_id uuid REFERENCES public.clients(id),
  ADD COLUMN project_group_id uuid REFERENCES public.project_groups(id) ON DELETE SET NULL,
  ADD COLUMN activity_type_id uuid REFERENCES public.time_activity_types(id),
  ADD COLUMN description text,
  ADD COLUMN source_assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL;

UPDATE public.time_entries t SET client_id = p.client_id, project_group_id = p.project_group_id
  FROM public.projects p WHERE p.id = t.project_id;
UPDATE public.time_entries SET activity_type_id = (SELECT id FROM public.time_activity_types WHERE name='Installation')
  WHERE activity_type_id IS NULL;

CREATE INDEX IF NOT EXISTS time_entries_entry_date_idx ON public.time_entries(entry_date);
CREATE INDEX IF NOT EXISTS time_entries_installer_idx ON public.time_entries(installer_id);
CREATE INDEX IF NOT EXISTS time_entries_client_idx ON public.time_entries(client_id);
CREATE INDEX IF NOT EXISTS time_entries_group_idx ON public.time_entries(project_group_id);
CREATE INDEX IF NOT EXISTS time_entries_project_idx ON public.time_entries(project_id);
CREATE INDEX IF NOT EXISTS time_entries_activity_idx ON public.time_entries(activity_type_id);

CREATE OR REPLACE FUNCTION public.validate_time_entry()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  _cust text; _p_client uuid; _p_group uuid; _g_client uuid; _day numeric; _me uuid; _d text;
BEGIN
  -- Non-admins can only write their own rows.
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(),'admin') THEN
    _me := current_installer_id();
    IF _me IS NULL THEN RAISE EXCEPTION 'Du saknar en medarbetarprofil'; END IF;
    NEW.installer_id := _me;
  END IF;

  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time <= NEW.start_time THEN RAISE EXCEPTION 'End time must be after start time'; END IF;
    NEW.hours := round(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2);
  END IF;
  IF NEW.hours IS NULL OR NEW.hours < 0 THEN RAISE EXCEPTION 'Hours cannot be negative'; END IF;
  IF NEW.hours > 24 THEN RAISE EXCEPTION 'En tidsrad får inte överstiga 24 timmar'; END IF;
  NEW.travel_hours := round(coalesce(NEW.travel_hours, 0), 2);
  IF NEW.travel_hours < 0 THEN RAISE EXCEPTION 'Travel time cannot be negative'; END IF;
  IF NEW.travel_hours > 12 THEN RAISE EXCEPTION 'Travel time cannot exceed 12 hours'; END IF;

  -- Order → derive/verify customer & project
  IF NEW.project_id IS NOT NULL THEN
    SELECT client_id, project_group_id INTO _p_client, _p_group FROM projects WHERE id = NEW.project_id;
    IF NEW.client_id IS NULL THEN NEW.client_id := _p_client; END IF;
    IF _p_client IS NOT NULL AND _p_client <> NEW.client_id THEN
      RAISE EXCEPTION 'Ordern tillhör inte vald kund'; END IF;
    IF NEW.project_group_id IS NULL THEN NEW.project_group_id := _p_group;
    ELSIF _p_group IS NOT NULL AND _p_group <> NEW.project_group_id THEN
      RAISE EXCEPTION 'Ordern tillhör inte valt projekt'; END IF;
  END IF;
  IF NEW.client_id IS NULL THEN RAISE EXCEPTION 'Välj en kund'; END IF;
  IF NEW.project_group_id IS NOT NULL THEN
    SELECT client_id INTO _g_client FROM project_groups WHERE id = NEW.project_group_id;
    IF _g_client IS DISTINCT FROM NEW.client_id THEN RAISE EXCEPTION 'Projektet tillhör inte vald kund'; END IF;
  END IF;

  IF NEW.project_id IS NULL AND NEW.hours <= 0 THEN RAISE EXCEPTION 'Antal timmar måste vara större än 0'; END IF;
  IF NEW.activity_type_id IS NULL THEN
    SELECT id INTO NEW.activity_type_id FROM time_activity_types WHERE name = 'Installation';
  END IF;

  SELECT customer_number INTO _cust FROM clients WHERE id = NEW.client_id;
  IF _cust = '9999' THEN
    _d := lower(trim(coalesce(NEW.description, NEW.note, '')));
    IF length(_d) < 15 OR _d IN ('internt','intern','övrigt','ovrigt','diverse','div','intern tid') THEN
      RAISE EXCEPTION 'Beskriv tydligt vad tiden avser för kund 9999';
    END IF;
  END IF;

  SELECT coalesce(sum(hours + travel_hours),0) INTO _day FROM time_entries
    WHERE installer_id = NEW.installer_id AND entry_date = NEW.entry_date AND id <> NEW.id;
  IF _day + NEW.hours + NEW.travel_hours > 24 THEN
    RAISE EXCEPTION 'Total tid för dagen får inte överstiga 24 timmar';
  END IF;
  RETURN NEW;
END; $function$;