DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.validate_assignment'::regproc);
  d := replace(d, 'WHERE a.installer_id = NEW.installer_id AND a.id <> NEW.id', 'WHERE a.installer_id = NEW.installer_id AND a.id <> NEW.id AND a.project_id <> NEW.project_id');
  EXECUTE d;
END $$;