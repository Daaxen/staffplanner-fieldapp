-- Document access rules, by document purpose.
-- Run with: psql "$SUPABASE_DB_URL" -f supabase/tests/documents_rls_test.sql
-- Replace the three account ids with real accounts in the target environment.
DO $$
DECLARE
  admin_id uuid := '26c86def-daf3-405c-82f0-f42752f5e2be';  -- an admin
  owner_id uuid := '240b5b41-2b07-49e9-9f9c-b6ee091bd3f2';  -- installer assigned to the test order
  other_id uuid := '947156a0-f9b5-4808-9e27-c4bee571c9aa';  -- installer with no assignment
  owner_inst uuid;
  cl uuid; pr uuid;
  d_pub uuid; d_int uuid; d_proj uuid; d_cli uuid; d_priv uuid;
  n int;
BEGIN
  SELECT id INTO owner_inst FROM public.installers WHERE profile_id = owner_id;

  INSERT INTO public.clients (name, vat_percent, data) VALUES ('RLS Doc Test Client', 25, '{}'::jsonb) RETURNING id INTO cl;
  INSERT INTO public.projects (name, project_type, status, client_id, data)
    VALUES ('RLS Doc Test Project', 'installation', 'open', cl, '{}'::jsonb) RETURNING id INTO pr;
  INSERT INTO public.project_assignees (project_id, installer_id) VALUES (pr, owner_inst);

  INSERT INTO public.documents (category, title, scope, visible_to_installers) VALUES ('guide','published','global_internal',true) RETURNING id INTO d_pub;
  INSERT INTO public.documents (category, title, scope) VALUES ('general','internal only','global_internal') RETURNING id INTO d_int;
  INSERT INTO public.documents (category, title, scope, project_id) VALUES ('general','order doc','project',pr) RETURNING id INTO d_proj;
  INSERT INTO public.documents (category, title, scope, client_id, is_sensitive) VALUES ('general','client doc','client',cl,true) RETURNING id INTO d_cli;
  INSERT INTO public.documents (category, title, scope, owner_id) VALUES ('general','private doc','installer_private',owner_id) RETURNING id INTO d_priv;

  -- ownership constraints
  BEGIN
    INSERT INTO public.documents (category,title,scope,project_id,visible_to_installers) VALUES ('general','bad','project',pr,true);
    RAISE EXCEPTION 'FAIL: an order document could be published to all installers';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK: only global documents can be published'; END;
  BEGIN
    INSERT INTO public.documents (category,title,scope) VALUES ('general','bad','client');
    RAISE EXCEPTION 'FAIL: client document accepted without a client';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK: client document requires a client'; END;
  BEGIN
    INSERT INTO public.documents (category,title,scope) VALUES ('general','bad','installer_private');
    RAISE EXCEPTION 'FAIL: private document accepted without an owner';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK: private document requires an owner'; END;

  SET LOCAL role authenticated;

  -- admin sees everything
  PERFORM set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.documents WHERE id IN (d_pub,d_int,d_proj,d_cli,d_priv);
  IF n <> 5 THEN RAISE EXCEPTION 'FAIL: admin sees % of 5 documents', n; END IF;
  RAISE NOTICE 'OK: admin sees all documents';

  -- assigned installer
  PERFORM set_config('request.jwt.claims', json_build_object('sub',owner_id,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.documents WHERE id = d_pub;  IF n<>1 THEN RAISE EXCEPTION 'FAIL: published global not visible'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_int;  IF n<>0 THEN RAISE EXCEPTION 'FAIL: unpublished internal visible'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_proj; IF n<>1 THEN RAISE EXCEPTION 'FAIL: own order document not visible'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_cli;  IF n<>0 THEN RAISE EXCEPTION 'FAIL: client document visible to installer'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_priv; IF n<>1 THEN RAISE EXCEPTION 'FAIL: own private document not visible'; END IF;
  RAISE NOTICE 'OK: assigned installer sees exactly the right documents';

  -- unassigned installer
  PERFORM set_config('request.jwt.claims', json_build_object('sub',other_id,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.documents WHERE id IN (d_int,d_proj,d_cli,d_priv);
  IF n<>0 THEN RAISE EXCEPTION 'FAIL: unassigned installer sees % restricted documents', n; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_pub; IF n<>1 THEN RAISE EXCEPTION 'FAIL: published global not visible'; END IF;
  BEGIN
    INSERT INTO public.documents (category,title,scope,owner_id) VALUES ('general','steal','installer_private',owner_id);
    RAISE EXCEPTION 'FAIL: created a private document owned by someone else';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK: cannot create a private document for another user'; END;
  RAISE NOTICE 'OK: unassigned installer is blocked';

  RESET role;
  DELETE FROM public.documents WHERE id IN (d_pub,d_int,d_proj,d_cli,d_priv);
  DELETE FROM public.project_assignees WHERE project_id = pr;
  DELETE FROM public.projects WHERE id = pr;
  DELETE FROM public.clients WHERE id = cl;
  RAISE NOTICE 'ALL DOCUMENT ACCESS TESTS PASSED';
END $$;
