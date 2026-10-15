-- Superuser inherits admin and HR everywhere.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR (role = 'superuser' AND _role IN ('admin','hr')))
  )
$$;

CREATE OR REPLACE FUNCTION public.has_hr_access(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('hr','superuser'))
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role app_role, _grant boolean DEFAULT true)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins may change roles';
  END IF;
  IF _role = 'superuser' AND NOT public.has_role(auth.uid(), 'superuser') THEN
    RAISE EXCEPTION 'Only a superuser may grant or remove the superuser role';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
      ON CONFLICT DO NOTHING;
  ELSE
    IF _role = 'admin' AND _user_id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot remove your own admin role';
    END IF;
    IF _role = 'superuser' AND (SELECT count(*) FROM public.user_roles WHERE role = 'superuser' AND user_id <> _user_id) = 0 THEN
      RAISE EXCEPTION 'The last superuser cannot be removed';
    END IF;
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  END IF;
END; $function$;

-- Audit every "view as installer" session.
CREATE OR REPLACE FUNCTION public.log_view_as(_installer_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'superuser') THEN
    RAISE EXCEPTION 'Only a superuser may view as another installer';
  END IF;
  SELECT name INTO v_name FROM public.installers WHERE id = _installer_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Installer not found'; END IF;
  INSERT INTO public.audit_log (actor_id, actor_type, actor_name, source, entity_type, entity_id, entity_label, action)
  VALUES (auth.uid(), 'admin', COALESCE(auth.jwt()->>'email', 'superuser'), 'app',
          'installer', _installer_id::text, v_name, 'view_as');
END; $$;
REVOKE ALL ON FUNCTION public.log_view_as(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_view_as(uuid) TO authenticated;

-- Bootstrap: the account owner becomes the first superuser.
INSERT INTO public.user_roles (user_id, role)
SELECT '26c86def-daf3-405c-82f0-f42752f5e2be'::uuid, 'superuser'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = '26c86def-daf3-405c-82f0-f42752f5e2be')
ON CONFLICT DO NOTHING;