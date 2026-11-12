ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Sverige';

CREATE TABLE public.per_diem_rates (
  year integer NOT NULL,
  country text NOT NULL,
  full_day numeric NOT NULL CHECK (full_day >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (year, country)
);
GRANT SELECT ON public.per_diem_rates TO authenticated;
GRANT ALL ON public.per_diem_rates TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.per_diem_rates TO authenticated;
ALTER TABLE public.per_diem_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "per diem rates readable by app users" ON public.per_diem_rates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid()));
CREATE POLICY "per diem rates admin write" ON public.per_diem_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.per_diem_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  installer_id uuid NOT NULL REFERENCES public.installers(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  country text NOT NULL DEFAULT 'Sverige',
  day_type text NOT NULL DEFAULT 'full' CHECK (day_type IN ('full','half','none')),
  overnight text NOT NULL DEFAULT 'hotel' CHECK (overnight IN ('hotel','private','none')),
  breakfast_provided boolean NOT NULL DEFAULT false,
  lunch_provided boolean NOT NULL DEFAULT false,
  dinner_provided boolean NOT NULL DEFAULT false,
  distance_confirmed boolean NOT NULL DEFAULT false,
  note text,
  rate_year integer,
  full_day_rate numeric NOT NULL DEFAULT 0,
  day_amount numeric NOT NULL DEFAULT 0,
  night_amount numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, installer_id, entry_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.per_diem_entries TO authenticated;
GRANT ALL ON public.per_diem_entries TO service_role;
ALTER TABLE public.per_diem_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pd own read" ON public.per_diem_entries FOR SELECT TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pd own insert" ON public.per_diem_entries FOR INSERT TO authenticated
  WITH CHECK (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pd own update" ON public.per_diem_entries FOR UPDATE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pd own delete" ON public.per_diem_entries FOR DELETE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));

-- Amounts are always derived here from Skatteverket's rates, never from the client.
CREATE OR REPLACE FUNCTION public.compute_per_diem_entry()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _year int; _rate numeric; _domestic boolean; _red numeric := 0; _meals int;
BEGIN
  _domestic := NEW.country = 'Sverige';
  SELECT year, full_day INTO _year, _rate FROM public.per_diem_rates
   WHERE country = NEW.country AND year <= extract(year FROM NEW.entry_date)::int
   ORDER BY year DESC LIMIT 1;
  IF _rate IS NULL THEN
    SELECT year, full_day INTO _year, _rate FROM public.per_diem_rates
     WHERE country = NEW.country ORDER BY year ASC LIMIT 1;
  END IF;
  IF _rate IS NULL THEN RAISE EXCEPTION 'Inget traktamentsbelopp finns för %', NEW.country; END IF;
  _meals := NEW.breakfast_provided::int + NEW.lunch_provided::int + NEW.dinner_provided::int;
  IF _meals = 3 THEN _red := CASE WHEN _domestic THEN 0.90 ELSE 0.85 END;
  ELSE
    IF NEW.breakfast_provided THEN _red := _red + CASE WHEN _domestic THEN 0.20 ELSE 0.15 END; END IF;
    IF NEW.lunch_provided THEN _red := _red + 0.35; END IF;
    IF NEW.dinner_provided THEN _red := _red + 0.35; END IF;
  END IF;
  NEW.rate_year := _year;
  NEW.full_day_rate := _rate;
  NEW.day_amount := round(CASE NEW.day_type WHEN 'full' THEN _rate WHEN 'half' THEN _rate * 0.5 ELSE 0 END * (1 - _red));
  NEW.night_amount := CASE WHEN NEW.overnight = 'private' THEN round(_rate * 0.5) ELSE 0 END;
  NEW.amount := NEW.day_amount + NEW.night_amount;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_per_diem_compute BEFORE INSERT OR UPDATE ON public.per_diem_entries
FOR EACH ROW EXECUTE FUNCTION public.compute_per_diem_entry();
CREATE TRIGGER trg_per_diem_lock BEFORE INSERT OR UPDATE OR DELETE ON public.per_diem_entries
FOR EACH ROW EXECUTE FUNCTION public.reject_time_on_completed_order();
CREATE INDEX per_diem_entries_project_idx ON public.per_diem_entries (project_id, entry_date);