-- RLS tests for public.clients
--
-- Verifies:
--   1. admins read all clients
--   2. an installer assigned to a project gets that client via assigned_clients()
--   3. an unassigned user gets nothing
--   4. sensitive commercial fields are never returned to installers
--
-- Safe to run repeatedly: fixtures are removed at the end.

CREATE TEMP TABLE IF NOT EXISTS rls_results(check_name text, value text, passed boolean);
GRANT INSERT, SELECT ON rls_results TO authenticated;

DO $$
DECLARE
  v_admin uuid;
  v_inst_profile uuid;
  v_other uuid;
  v_installer uuid; v_client uuid; v_project uuid;
  v_cnt int; v_assigned int; v_keys text[];
  v_forbidden text[] := ARRAY['rates','invoicing','customerNumber','hourlyRate','overtimeRate','mileageRate','vatPercent'];
BEGIN
  SELECT user_id INTO v_admin FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  SELECT p.id INTO v_inst_profile FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'installer' LIMIT 1;
  SELECT p.id INTO v_other FROM public.profiles p
    WHERE p.id <> COALESCE(v_admin, gen_random_uuid()) AND p.id <> COALESCE(v_inst_profile, gen_random_uuid()) LIMIT 1;

  SELECT id INTO v_installer FROM public.installers WHERE profile_id = v_inst_profile LIMIT 1;

  INSERT INTO public.clients (name, ref, hourly_rate, overtime_rate, mileage_rate, vat_percent, data, sandbox)
  VALUES ('ZZ RLS Test Client','ZZ-RLS-TEST',999,1499,45,25,
    jsonb_build_object('id','ZZ-RLS-TEST','name','ZZ RLS Test Client','street','Testgatan 1','region','Test',
      'customerNumber','SECRET-CUST','mainContact', jsonb_build_object('name','Test Contact','phone','070'),
      'rates', jsonb_build_object('hourlyRate',999), 'invoicing', jsonb_build_object('vatNumber','SE999')), false)
  RETURNING id INTO v_client;

  INSERT INTO public.projects (name, project_type, client_id, status, ref, data, sandbox)
  VALUES ('ZZ RLS Test Project','installation',v_client,'open','ZZ-RLS-P',
          jsonb_build_object('client','ZZ RLS Test Client'), false)
  RETURNING id INTO v_project;

  INSERT INTO public.project_assignees (project_id, installer_id) VALUES (v_project, v_installer);

  SET LOCAL ROLE authenticated;

  -- 1. admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  SELECT count(*) INTO v_cnt FROM public.clients;
  INSERT INTO rls_results VALUES ('admin reads all clients', v_cnt::text, v_cnt >= 1);

  -- 2. assigned installer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_inst_profile, 'role','authenticated')::text, true);
  SELECT count(*) INTO v_cnt FROM public.clients;
  SELECT count(*) INTO v_assigned FROM public.assigned_clients();
  INSERT INTO rls_results VALUES ('installer cannot read clients table', v_cnt::text, v_cnt = 0);
  INSERT INTO rls_results VALUES ('assigned installer sees assigned client', v_assigned::text, v_assigned >= 1);

  -- 4. no sensitive fields
  SELECT array_agg(DISTINCT k) INTO v_keys FROM public.assigned_clients() ac, jsonb_object_keys(ac.data) k;
  INSERT INTO rls_results VALUES ('no commercial fields for installer', array_to_string(v_keys, ','),
    NOT (v_keys && v_forbidden));

  -- 3. unassigned user
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other, 'role','authenticated')::text, true);
  SELECT count(*) INTO v_cnt FROM public.clients;
  SELECT count(*) INTO v_assigned FROM public.assigned_clients();
  INSERT INTO rls_results VALUES ('unassigned user sees no clients', v_cnt::text, v_cnt = 0);
  INSERT INTO rls_results VALUES ('unassigned user gets no rows from rpc', v_assigned::text, v_assigned = 0);

  RESET ROLE;

  DELETE FROM public.project_assignees WHERE project_id = v_project;
  DELETE FROM public.projects WHERE id = v_project;
  DELETE FROM public.clients WHERE id = v_client;
END $$;

SELECT * FROM rls_results;
