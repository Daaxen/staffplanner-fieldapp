CREATE OR REPLACE FUNCTION public.ensure_installer_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_color int;
BEGIN
  IF NEW.role <> 'installer'::app_role THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.installers WHERE profile_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(p.full_name), ''), split_part(COALESCE(p.email, 'Installer'), '@', 1))
    INTO v_name
  FROM public.profiles p WHERE p.id = NEW.user_id;

  SELECT (COALESCE(COUNT(*), 0) % 6) + 1 INTO v_color FROM public.installers;

  INSERT INTO public.installers (name, color, type, profile_id, sandbox)
  VALUES (COALESCE(v_name, 'Installer'), v_color, 'own', NEW.user_id, false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_installer ON public.user_roles;
CREATE TRIGGER trg_user_roles_installer
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.ensure_installer_record();

REVOKE EXECUTE ON FUNCTION public.ensure_installer_record() FROM PUBLIC, anon, authenticated;

INSERT INTO public.installers (name, color, type, profile_id, sandbox)
SELECT COALESCE(NULLIF(TRIM(p.full_name), ''), split_part(COALESCE(p.email, 'Installer'), '@', 1)),
       ((row_number() OVER (ORDER BY p.created_at)) % 6) + 1,
       'own', p.id, false
FROM public.profiles p
JOIN public.user_roles r ON r.user_id = p.id AND r.role = 'installer'
WHERE NOT EXISTS (SELECT 1 FROM public.installers i WHERE i.profile_id = p.id);

CREATE POLICY "installers update own record"
ON public.installers FOR UPDATE TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());