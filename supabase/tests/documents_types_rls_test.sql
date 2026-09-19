-- Access rules per document type: project, sensitive project, internal, HR, installer-private.
-- Run with: psql "$SUPABASE_DB_URL" -f supabase/tests/documents_types_rls_test.sql
DO $$
DECLARE
  admin_id uuid := '26c86def-daf3-405c-82f0-f42752f5e2be';  -- admin
  owner_id uuid := '240b5b41-2b07-49e9-9f9c-b6ee091bd3f2';  -- installer assigned to the test order
  other_id uuid := '947156a0-f9b5-4808-9e27-c4bee571c9aa';  -- installer assigned to the same order, no grant
  owner_inst uuid; other_inst uuid;
  cl uuid; pr uuid;
  d_int uuid; d_pub uuid; d_proj uuid; d_sens uuid; d_hr uuid; d_priv uuid;
  hr_added boolean := false;
  n int;
BEGIN
  SELECT id INTO owner_inst FROM public.installers WHERE profile_id = owner_id;
  SELECT id INTO other_inst FROM public.installers WHERE profile_id = other_id;

  INSERT INTO public.clients (name, vat_percent, data) VALUES ('Doc Type Test Client', 25, '{}'::jsonb) RETURNING id INTO cl;
  INSERT INTO public.projects (name, project_type, status, client_id, data)
    VALUES ('Doc Type Test Project', 'installation', 'open', cl, '{}'::jsonb) RETURNING id INTO pr;
  INSERT INTO public.project_assignees (project_id, installer_id) VALUES (pr, owner_inst), (pr, other_inst);

  INSERT INTO public.documents (category,title,scope) VALUES ('general','internal only','global_internal') RETURNING id INTO d_int;
  INSERT INTO public.documents (category,title,scope,visible_to_installers) VALUES ('guide','published internal','global_internal',true) RETURNING id INTO d_pub;
  INSERT INTO public.documents (category,title,scope,project_id) VALUES ('general','order doc','project',pr) RETURNING id INTO d_proj;
  INSERT INTO public.documents (category,title,scope,project_id,is_sensitive) VALUES ('general','sensitive order doc','project_sensitive',pr,true) RETURNING id INTO d_sens;
  INSERT INTO public.documents (category,title,scope) VALUES ('general','hr doc','hr') RETURNING id INTO d_hr;
  INSERT INTO public.documents (category,title,scope,owner_id) VALUES ('general','private doc','installer_private',owner_id) RETURNING id INTO d_priv;

  -- constraints
  BEGIN
    INSERT INTO public.documents (category,title,scope,project_id,is_sensitive) VALUES ('general','bad','project_sensitive',pr,false);
    RAISE EXCEPTION 'FAIL: sensitive order document accepted without the sensitive flag';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK: sensitive order documents are always flagged sensitive'; END;
  BEGIN
    INSERT INTO public.documents (category,title,scope) VALUES ('general','bad','project_sensitive');
    RAISE EXCEPTION 'FAIL: sensitive order document accepted without an order';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK: sensitive order document requires an order'; END;
  BEGIN
    INSERT INTO public.documents (category,title,scope,visible_to_installers) VALUES ('general','bad','hr',true);
    RAISE EXCEPTION 'FAIL: HR document could be published to field staff';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK: only global documents can be published'; END;

  SET LOCAL role authenticated;

  -- admin sees every type
  PERFORM set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.documents WHERE id IN (d_int,d_pub,d_proj,d_sens,d_hr,d_priv);
  IF n <> 6 THEN RAISE EXCEPTION 'FAIL: admin sees % of 6 documents', n; END IF;
  RAISE NOTICE 'OK: admin sees all document types';

  -- assigned installer without a grant
  PERFORM set_config('request.jwt.claims', json_build_object('sub',owner_id,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.documents WHERE id = d_pub;  IF n<>1 THEN RAISE EXCEPTION 'FAIL: published internal not visible'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_int;  IF n<>0 THEN RAISE EXCEPTION 'FAIL: unpublished internal visible'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_proj; IF n<>1 THEN RAISE EXCEPTION 'FAIL: own order document not visible'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_sens; IF n<>0 THEN RAISE EXCEPTION 'FAIL: sensitive order document visible without a grant'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_hr;   IF n<>0 THEN RAISE EXCEPTION 'FAIL: HR document visible to installer'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_priv; IF n<>1 THEN RAISE EXCEPTION 'FAIL: own private document not visible'; END IF;
  RAISE NOTICE 'OK: assignment alone does not unlock sensitive order documents';

  -- an installer cannot grant themselves access
  BEGIN
    INSERT INTO public.document_access (document_id, profile_id, reason) VALUES (d_sens, owner_id, 'self service');
    RAISE EXCEPTION 'FAIL: installer granted themselves access';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK: installers cannot grant document access'; END;

  -- admin grants explicit access
  PERFORM set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated')::text, true);
  INSERT INTO public.document_access (document_id, profile_id, reason) VALUES (d_sens, owner_id, 'needs the wiring drawing');

  PERFORM set_config('request.jwt.claims', json_build_object('sub',owner_id,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.documents WHERE id = d_sens; IF n<>1 THEN RAISE EXCEPTION 'FAIL: granted installer cannot read the sensitive document'; END IF;
  RAISE NOTICE 'OK: explicit grant unlocks the sensitive order document';

  -- other installer on the same order still cannot
  PERFORM set_config('request.jwt.claims', json_build_object('sub',other_id,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.documents WHERE id = d_sens; IF n<>0 THEN RAISE EXCEPTION 'FAIL: other project member sees the sensitive document'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_priv; IF n<>0 THEN RAISE EXCEPTION 'FAIL: private document leaked to another user'; END IF;
  RAISE NOTICE 'OK: other project members stay blocked';

  -- HR role sees HR documents
  RESET role;
  IF NOT public.has_hr_access(other_id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (other_id, 'hr') ON CONFLICT DO NOTHING;
    hr_added := true;
  END IF;
  SET LOCAL role authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',other_id,'role','authenticated')::text, true);
  SELECT count(*) INTO n FROM public.documents WHERE id = d_hr; IF n<>1 THEN RAISE EXCEPTION 'FAIL: HR cannot read HR documents'; END IF;
  SELECT count(*) INTO n FROM public.documents WHERE id = d_sens; IF n<>0 THEN RAISE EXCEPTION 'FAIL: HR role unlocked a sensitive order document'; END IF;
  RAISE NOTICE 'OK: HR documents are limited to HR and admins';

  RESET role;
  IF hr_added THEN DELETE FROM public.user_roles WHERE user_id = other_id AND role = 'hr'; END IF;
  DELETE FROM public.document_access WHERE document_id = d_sens;
  DELETE FROM public.documents WHERE id IN (d_int,d_pub,d_proj,d_sens,d_hr,d_priv);
  DELETE FROM public.project_assignees WHERE project_id = pr;
  DELETE FROM public.projects WHERE id = pr;
  DELETE FROM public.clients WHERE id = cl;
  RAISE NOTICE 'ALL DOCUMENT TYPE ACCESS TESTS PASSED';
END $$;
