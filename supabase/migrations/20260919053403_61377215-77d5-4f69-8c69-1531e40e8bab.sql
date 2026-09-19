-- 1 + 2. Safe deduplication: merge duplicates onto the oldest record per profile.
DO $dedup$
DECLARE
  d record;
  keep uuid;
  dup uuid;
BEGIN
  FOR d IN
    SELECT profile_id FROM public.installers
    WHERE profile_id IS NOT NULL
    GROUP BY profile_id HAVING count(*) > 1
  LOOP
    SELECT id INTO keep FROM public.installers
     WHERE profile_id = d.profile_id ORDER BY created_at, id LIMIT 1;

    FOR dup IN
      SELECT id FROM public.installers
       WHERE profile_id = d.profile_id AND id <> keep
    LOOP
      UPDATE public.assignments           SET installer_id = keep WHERE installer_id = dup;
      UPDATE public.assignment_overrides  SET installer_id = keep WHERE installer_id = dup;
      UPDATE public.installer_absences    SET installer_id = keep WHERE installer_id = dup;
      UPDATE public.time_entries          SET installer_id = keep WHERE installer_id = dup;
      UPDATE public.expense_entries       SET installer_id = keep WHERE installer_id = dup;
      UPDATE public.mileage_entries       SET installer_id = keep WHERE installer_id = dup;
      UPDATE public.deviations            SET installer_id = keep WHERE installer_id = dup;
      UPDATE public.reminders             SET installer_id = keep WHERE installer_id = dup;

      -- rows with their own uniqueness: move what does not collide, drop the rest
      UPDATE public.field_reports f SET installer_id = keep
       WHERE f.installer_id = dup
         AND NOT EXISTS (SELECT 1 FROM public.field_reports k
                          WHERE k.installer_id = keep AND k.project_ref = f.project_ref);
      DELETE FROM public.field_reports WHERE installer_id = dup;

      DELETE FROM public.active_timers WHERE installer_id = dup;

      UPDATE public.project_assignees p SET installer_id = keep
       WHERE p.installer_id = dup
         AND NOT EXISTS (SELECT 1 FROM public.project_assignees k
                          WHERE k.installer_id = keep AND k.project_id = p.project_id);
      DELETE FROM public.project_assignees WHERE installer_id = dup;

      DELETE FROM public.installers WHERE id = dup;
      RAISE NOTICE 'Merged duplicate installer % into % (profile %)', dup, keep, d.profile_id;
    END LOOP;
  END LOOP;
END $dedup$;

-- 3. One installer record per linked account (profile_id stays nullable so that
--    external subcontractors can exist without a login — this is intentional).
CREATE UNIQUE INDEX IF NOT EXISTS installers_profile_id_unique
  ON public.installers (profile_id) WHERE profile_id IS NOT NULL;

-- 5. Race-proof automatic provisioning of the installer record.
CREATE OR REPLACE FUNCTION public.ensure_installer_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_name text;
  v_color int;
BEGIN
  IF NEW.role <> 'installer'::app_role OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(p.full_name), ''), split_part(COALESCE(p.email, 'Installer'), '@', 1))
    INTO v_name
  FROM public.profiles p WHERE p.id = NEW.user_id;

  SELECT (COALESCE(COUNT(*), 0) % 6) + 1 INTO v_color FROM public.installers;

  -- Concurrent role assignments for the same user must not create a second
  -- installer record; the partial unique index settles the race.
  INSERT INTO public.installers (name, color, type, profile_id, sandbox)
  VALUES (COALESCE(v_name, 'Installer'), v_color, 'own', NEW.user_id, false)
  ON CONFLICT (profile_id) WHERE profile_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$fn$;