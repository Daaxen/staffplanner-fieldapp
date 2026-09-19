-- Integrity tests for the canonical installer identity.
-- Run as a superuser/service role. Rolls everything back at the end.
BEGIN;

DO $$
DECLARE
  v_installer uuid;
  v_project uuid;
  v_profile uuid;
  v_other_profile uuid;
BEGIN
  SELECT id, profile_id INTO v_installer, v_profile
  FROM public.installers WHERE profile_id IS NOT NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO v_other_profile FROM public.profiles WHERE id <> v_profile LIMIT 1;

  INSERT INTO public.projects (name, project_type, status, ref, data)
  VALUES ('Identity test', 'installation', 'open', 'IDTEST-1', '{}'::jsonb)
  RETURNING id INTO v_project;

  -- 1. every operational installer_id must reference public.installers
  FOR v_project IN SELECT v_project LOOP END LOOP;

  BEGIN
    INSERT INTO public.time_entries (project_id, installer_id, entry_date, hours, source)
    VALUES (v_project, v_other_profile, current_date, 1, 'manual');
    RAISE EXCEPTION 'FAIL: a login account id was accepted as installer_id';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'OK time_entries rejects a non-installer id';
  END;

  BEGIN
    INSERT INTO public.field_reports (project_ref, installer_id)
    VALUES ('IDTEST-1', v_other_profile);
    RAISE EXCEPTION 'FAIL: field_reports accepted a non-installer id';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'OK field_reports rejects a non-installer id';
  END;

  -- 2. a valid installer id is accepted
  INSERT INTO public.time_entries (project_id, installer_id, entry_date, hours, source)
  VALUES (v_project, v_installer, current_date, 1, 'manual');
  RAISE NOTICE 'OK time_entries accepts an installer id';

  -- 3. financial records block deletion of the installer record
  BEGIN
    DELETE FROM public.installers WHERE id = v_installer;
    RAISE EXCEPTION 'FAIL: installer with financial records could be deleted';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'OK installer deletion restricted by financial records';
  END;

  -- 4. one installer record per login account
  BEGIN
    INSERT INTO public.installers (name, color, type, profile_id, sandbox)
    VALUES ('Duplicate', 1, 'own', v_profile, false);
    RAISE EXCEPTION 'FAIL: a second installer record for the same login was allowed';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK one installer record per login account';
  END;
END $$;

ROLLBACK;
