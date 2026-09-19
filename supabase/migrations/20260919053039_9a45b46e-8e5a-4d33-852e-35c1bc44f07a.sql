-- 1. One installer record per linked login account
CREATE UNIQUE INDEX IF NOT EXISTS installers_profile_id_unique
  ON public.installers (profile_id) WHERE profile_id IS NOT NULL;

-- 2. Canonical identity helper: the installer record of the signed-in user
CREATE OR REPLACE FUNCTION public.current_installer_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.installers WHERE profile_id = auth.uid() LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_installer_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_installer_id() TO authenticated;

-- 3. Repoint operational tables from auth.users to public.installers
DO $mig$
DECLARE
  t text;
  fk text;
  tables text[] := ARRAY['time_entries','expense_entries','mileage_entries','active_timers',
                         'deviations','field_reports','reminders'];
  id_col text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    id_col := CASE WHEN t = 'active_timers' THEN 'installer_id' ELSE 'id' END;
    -- drop the existing auth.users foreign key
    FOR fk IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = format('public.%I', t)::regclass AND contype = 'f'
        AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                            WHERE attrelid = format('public.%I', t)::regclass
                              AND attname = 'installer_id')]
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, fk);
    END LOOP;

    -- migrate values through installers.profile_id
    EXECUTE format($q$
      UPDATE public.%I r SET installer_id = i.id
      FROM public.installers i
      WHERE i.profile_id = r.installer_id
    $q$, t);

    -- report rows that could not be matched, then detach them from the migration
    EXECUTE format($q$
      INSERT INTO public.reporting_migration_unmatched (table_name, row_id, raw_project_id)
      SELECT %L, r.%I, r.installer_id::text
      FROM public.%I r
      LEFT JOIN public.installers i ON i.id = r.installer_id
      WHERE i.id IS NULL
    $q$, t || '.installer_id', id_col, t);
  END LOOP;
END $mig$;

-- unmatched rows would violate the new keys; none exist, but guard explicitly
DO $g$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.reporting_migration_unmatched
   WHERE table_name LIKE '%.installer_id';
  IF n > 0 THEN
    RAISE EXCEPTION 'Cannot add installer foreign keys: % unmatched rows reported', n;
  END IF;
END $g$;

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_installer_id_fkey
  FOREIGN KEY (installer_id) REFERENCES public.installers(id) ON DELETE RESTRICT;
ALTER TABLE public.expense_entries
  ADD CONSTRAINT expense_entries_installer_id_fkey
  FOREIGN KEY (installer_id) REFERENCES public.installers(id) ON DELETE RESTRICT;
ALTER TABLE public.mileage_entries
  ADD CONSTRAINT mileage_entries_installer_id_fkey
  FOREIGN KEY (installer_id) REFERENCES public.installers(id) ON DELETE RESTRICT;
ALTER TABLE public.deviations
  ADD CONSTRAINT deviations_installer_id_fkey
  FOREIGN KEY (installer_id) REFERENCES public.installers(id) ON DELETE RESTRICT;
ALTER TABLE public.field_reports
  ADD CONSTRAINT field_reports_installer_id_fkey
  FOREIGN KEY (installer_id) REFERENCES public.installers(id) ON DELETE RESTRICT;
ALTER TABLE public.active_timers
  ADD CONSTRAINT active_timers_installer_id_fkey
  FOREIGN KEY (installer_id) REFERENCES public.installers(id) ON DELETE CASCADE;
ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_installer_id_fkey
  FOREIGN KEY (installer_id) REFERENCES public.installers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS deviations_installer_idx ON public.deviations (installer_id);
CREATE INDEX IF NOT EXISTS field_reports_installer_idx ON public.field_reports (installer_id);
CREATE INDEX IF NOT EXISTS reminders_installer_idx ON public.reminders (installer_id);

-- 4. RLS now compares against the installer record, not the login account
DROP POLICY IF EXISTS "timer own all" ON public.active_timers;
CREATE POLICY "timer own all" ON public.active_timers FOR ALL TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (installer_id = public.current_installer_id());

DROP POLICY IF EXISTS "Installers manage own deviations" ON public.deviations;
CREATE POLICY "Installers manage own deviations" ON public.deviations FOR ALL TO authenticated
  USING (installer_id = public.current_installer_id())
  WITH CHECK (installer_id = public.current_installer_id());

DROP POLICY IF EXISTS "installers manage own field reports" ON public.field_reports;
CREATE POLICY "installers manage own field reports" ON public.field_reports FOR ALL TO authenticated
  USING (installer_id = public.current_installer_id())
  WITH CHECK (installer_id = public.current_installer_id());

DROP POLICY IF EXISTS "time own read" ON public.time_entries;
DROP POLICY IF EXISTS "time own insert" ON public.time_entries;
DROP POLICY IF EXISTS "time own update" ON public.time_entries;
DROP POLICY IF EXISTS "time own delete" ON public.time_entries;
CREATE POLICY "time own read" ON public.time_entries FOR SELECT TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "time own insert" ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "time own update" ON public.time_entries FOR UPDATE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "time own delete" ON public.time_entries FOR DELETE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "exp own read" ON public.expense_entries;
DROP POLICY IF EXISTS "exp own insert" ON public.expense_entries;
DROP POLICY IF EXISTS "exp own update" ON public.expense_entries;
DROP POLICY IF EXISTS "exp own delete" ON public.expense_entries;
CREATE POLICY "exp own read" ON public.expense_entries FOR SELECT TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "exp own insert" ON public.expense_entries FOR INSERT TO authenticated
  WITH CHECK (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "exp own update" ON public.expense_entries FOR UPDATE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "exp own delete" ON public.expense_entries FOR DELETE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "mil own read" ON public.mileage_entries;
DROP POLICY IF EXISTS "mil own insert" ON public.mileage_entries;
DROP POLICY IF EXISTS "mil own update" ON public.mileage_entries;
DROP POLICY IF EXISTS "mil own delete" ON public.mileage_entries;
CREATE POLICY "mil own read" ON public.mileage_entries FOR SELECT TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mil own insert" ON public.mileage_entries FOR INSERT TO authenticated
  WITH CHECK (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mil own update" ON public.mileage_entries FOR UPDATE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mil own delete" ON public.mileage_entries FOR DELETE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Installers view own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Installers update own reminders" ON public.reminders;
CREATE POLICY "Installers view own reminders" ON public.reminders FOR SELECT TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Installers update own reminders" ON public.reminders FOR UPDATE TO authenticated
  USING (installer_id = public.current_installer_id() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "View events for own reminders" ON public.reminder_events;
CREATE POLICY "View events for own reminders" ON public.reminder_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.reminders r
    WHERE r.id = reminder_events.reminder_id
      AND r.installer_id = public.current_installer_id()));