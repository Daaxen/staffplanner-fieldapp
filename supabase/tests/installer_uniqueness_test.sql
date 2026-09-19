-- One installer record per user profile: uniqueness + concurrency.
-- Run as service role. Everything is rolled back at the end.
BEGIN;

DO $$
DECLARE
  v_profile uuid;
  v_before int;
  v_after int;
BEGIN
  SELECT profile_id INTO v_profile
  FROM public.installers WHERE profile_id IS NOT NULL ORDER BY created_at LIMIT 1;

  -- 1. no duplicates exist
  PERFORM 1 FROM (
    SELECT profile_id FROM public.installers
     WHERE profile_id IS NOT NULL GROUP BY profile_id HAVING count(*) > 1
  ) s;
  IF FOUND THEN RAISE EXCEPTION 'FAIL: duplicate profile_id values exist'; END IF;
  RAISE NOTICE 'OK no duplicate profile_id values';

  -- 2. the unique index rejects a second record for the same profile
  BEGIN
    INSERT INTO public.installers (name, color, type, profile_id, sandbox)
    VALUES ('Duplicate', 1, 'own', v_profile, false);
    RAISE EXCEPTION 'FAIL: duplicate installer record accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'OK unique index rejects duplicates';
  END;

  -- 3. subcontractors without a login are still allowed (profile_id nullable)
  INSERT INTO public.installers (name, color, type, profile_id, sandbox)
  VALUES ('Sub A', 2, 'sub-vendor', NULL, false);
  INSERT INTO public.installers (name, color, type, profile_id, sandbox)
  VALUES ('Sub B', 3, 'sub-vendor', NULL, false);
  RAISE NOTICE 'OK multiple installers without a login allowed';
  DELETE FROM public.installers WHERE name IN ('Sub A', 'Sub B');

  -- 4. concurrency: two simultaneous provisioning attempts for the same profile
  --    resolve to exactly one record (this is the ON CONFLICT path used by
  --    ensure_installer_record when two role assignments race).
  SELECT count(*) INTO v_before FROM public.installers WHERE profile_id = v_profile;
  INSERT INTO public.installers (name, color, type, profile_id, sandbox)
  VALUES ('Racer 1', 1, 'own', v_profile, false),
         ('Racer 2', 1, 'own', v_profile, false)
  ON CONFLICT (profile_id) WHERE profile_id IS NOT NULL DO NOTHING;
  SELECT count(*) INTO v_after FROM public.installers WHERE profile_id = v_profile;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'FAIL: concurrent provisioning created % extra records', v_after - v_before;
  END IF;
  RAISE NOTICE 'OK concurrent provisioning yields exactly one record';

  -- 5. re-running the trigger for an existing installer is a no-op
  SELECT count(*) INTO v_before FROM public.installers WHERE profile_id = v_profile;
  DELETE FROM public.user_roles WHERE user_id = v_profile AND role = 'installer';
  INSERT INTO public.user_roles (user_id, role) VALUES (v_profile, 'installer');
  SELECT count(*) INTO v_after FROM public.installers WHERE profile_id = v_profile;
  IF v_after <> v_before THEN
    RAISE EXCEPTION 'FAIL: re-assigning the installer role duplicated the record';
  END IF;
  RAISE NOTICE 'OK repeated role assignment does not duplicate the installer record';
END $$;

ROLLBACK;
