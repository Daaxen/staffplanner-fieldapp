-- Tests for installer self-service restrictions on public.installers
--
-- Verifies:
--   1. an installer cannot UPDATE their own row directly (no column-level trust)
--   2. installer_update_self() changes base_location only
--   3. type, profile_id, sandbox, name and color are untouched by self-service
--   4. input validation rejects an over-long base_location
--   5. admins can still change everything
--
-- Safe to run repeatedly: the original values are restored at the end.

CREATE TEMP TABLE IF NOT EXISTS rls_results(check_name text, value text, passed boolean);
GRANT INSERT, SELECT ON rls_results TO authenticated;

DO $$
DECLARE
  v_admin uuid;
  v_profile uuid;
  v_id uuid;
  v_before public.installers%ROWTYPE;
  v_after public.installers%ROWTYPE;
  v_err text;
BEGIN
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT id, profile_id INTO v_id, v_profile FROM public.installers WHERE profile_id IS NOT NULL LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO rls_results VALUES ('no installer with a linked account to test', '', false);
    RETURN;
  END IF;
  SELECT * INTO v_before FROM public.installers WHERE id = v_id;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_profile, 'role','authenticated')::text, true);

  -- 1. direct update must fail (privilege revoked)
  BEGIN
    UPDATE public.installers SET type = 'sub-vendor', sandbox = true WHERE id = v_id;
    INSERT INTO rls_results VALUES ('direct update blocked', 'update succeeded', false);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    INSERT INTO rls_results VALUES ('direct update blocked', v_err, true);
  END;

  -- 2 + 3. self-service RPC only touches base_location
  PERFORM public.installer_update_self('Test Base 42');
  SELECT * INTO v_after FROM public.installers WHERE id = v_id;
  INSERT INTO rls_results VALUES ('base_location updated', v_after.base_location, v_after.base_location = 'Test Base 42');
  INSERT INTO rls_results VALUES ('type unchanged', v_after.type, v_after.type IS NOT DISTINCT FROM v_before.type);
  INSERT INTO rls_results VALUES ('profile_id unchanged', v_after.profile_id::text, v_after.profile_id IS NOT DISTINCT FROM v_before.profile_id);
  INSERT INTO rls_results VALUES ('sandbox unchanged', v_after.sandbox::text, v_after.sandbox IS NOT DISTINCT FROM v_before.sandbox);
  INSERT INTO rls_results VALUES ('name unchanged', v_after.name, v_after.name IS NOT DISTINCT FROM v_before.name);
  INSERT INTO rls_results VALUES ('color unchanged', v_after.color::text, v_after.color IS NOT DISTINCT FROM v_before.color);

  -- 4. validation
  BEGIN
    PERFORM public.installer_update_self(repeat('x', 201));
    INSERT INTO rls_results VALUES ('over-long base_location rejected', 'accepted', false);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO rls_results VALUES ('over-long base_location rejected', SQLERRM, true);
  END;

  -- 5. admin can still manage the row
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  BEGIN
    UPDATE public.installers SET name = v_before.name WHERE id = v_id;
    INSERT INTO rls_results VALUES ('admin can still update installers', 'ok', true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO rls_results VALUES ('admin can still update installers', SQLERRM, false);
  END;

  RESET ROLE;

  UPDATE public.installers
     SET base_location = v_before.base_location, name = v_before.name, color = v_before.color,
         type = v_before.type, profile_id = v_before.profile_id, sandbox = v_before.sandbox
   WHERE id = v_id;
END $$;

SELECT * FROM rls_results;
