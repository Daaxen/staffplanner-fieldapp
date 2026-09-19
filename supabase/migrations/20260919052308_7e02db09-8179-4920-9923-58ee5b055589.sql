-- 1. Who may see sensitive personnel data
CREATE OR REPLACE FUNCTION public.has_hr_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'hr')
$$;
REVOKE ALL ON FUNCTION public.has_hr_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_hr_access(uuid) TO authenticated;

-- 2. Sensitive employee record
CREATE TABLE IF NOT EXISTS public.employee_private_details (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  date_of_birth date,
  medical_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  emergency_contact2_name text,
  emergency_contact2_phone text,
  clothing_size text,
  shoe_size text,
  drivers_license text,
  employment_start_date date,
  employment_end_date date,
  retain_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_private_employment_dates CHECK (
    employment_end_date IS NULL OR employment_start_date IS NULL
    OR employment_end_date >= employment_start_date
  )
);

-- No direct table access for app users: everything goes through the audited RPCs below.
REVOKE ALL ON public.employee_private_details FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.employee_private_details TO service_role;
ALTER TABLE public.employee_private_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee private details hr only"
  ON public.employee_private_details FOR ALL TO authenticated
  USING (public.has_hr_access(auth.uid()) OR profile_id = auth.uid())
  WITH CHECK (public.has_hr_access(auth.uid()) OR profile_id = auth.uid());

CREATE TRIGGER trg_employee_private_updated
  BEFORE UPDATE ON public.employee_private_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Access audit trail (append only)
CREATE TABLE IF NOT EXISTS public.employee_private_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  accessed_by uuid,
  action text NOT NULL CHECK (action IN ('read', 'write', 'delete', 'purge')),
  fields text[],
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS employee_private_access_log_profile_idx
  ON public.employee_private_access_log (profile_id, created_at DESC);

GRANT SELECT ON public.employee_private_access_log TO authenticated;
GRANT ALL ON public.employee_private_access_log TO service_role;
ALTER TABLE public.employee_private_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee private access log hr read"
  ON public.employee_private_access_log FOR SELECT TO authenticated
  USING (public.has_hr_access(auth.uid()));

-- 4. Retention: keep while employed, then 24 months after the employment ends
CREATE OR REPLACE FUNCTION public.set_employee_private_retention()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.retain_until := CASE
    WHEN NEW.employment_end_date IS NULL THEN NULL
    ELSE NEW.employment_end_date + INTERVAL '24 months'
  END::date;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_employee_private_retention
  BEFORE INSERT OR UPDATE ON public.employee_private_details
  FOR EACH ROW EXECUTE FUNCTION public.set_employee_private_retention();

CREATE OR REPLACE FUNCTION public.purge_expired_employee_private_details()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  WITH purged AS (
    DELETE FROM public.employee_private_details
    WHERE retain_until IS NOT NULL AND retain_until < current_date
    RETURNING profile_id
  ), logged AS (
    INSERT INTO public.employee_private_access_log (profile_id, accessed_by, action, reason)
    SELECT profile_id, NULL, 'purge', 'Retention period expired'
    FROM purged
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM logged;
  RETURN v_count;
END; $$;
REVOKE ALL ON FUNCTION public.purge_expired_employee_private_details() FROM PUBLIC, anon, authenticated;

-- 5. Audited read
CREATE OR REPLACE FUNCTION public.get_employee_private_details(_profile_id uuid, _reason text DEFAULT NULL)
RETURNS public.employee_private_details
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.employee_private_details;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _profile_id <> auth.uid() AND NOT public.has_hr_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only HR may read another employee''s private details';
  END IF;

  SELECT * INTO v_row FROM public.employee_private_details WHERE profile_id = _profile_id;

  INSERT INTO public.employee_private_access_log (profile_id, accessed_by, action, reason)
  VALUES (_profile_id, auth.uid(), 'read', NULLIF(btrim(COALESCE(_reason, '')), ''));

  RETURN v_row;
END; $$;
REVOKE ALL ON FUNCTION public.get_employee_private_details(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_employee_private_details(uuid, text) TO authenticated;

-- 6. Audited write
CREATE OR REPLACE FUNCTION public.upsert_employee_private_details(
  _profile_id uuid,
  _date_of_birth date DEFAULT NULL,
  _medical_notes text DEFAULT NULL,
  _emergency_contact_name text DEFAULT NULL,
  _emergency_contact_phone text DEFAULT NULL,
  _emergency_contact_relation text DEFAULT NULL,
  _emergency_contact2_name text DEFAULT NULL,
  _emergency_contact2_phone text DEFAULT NULL,
  _clothing_size text DEFAULT NULL,
  _shoe_size text DEFAULT NULL,
  _drivers_license text DEFAULT NULL,
  _employment_start_date date DEFAULT NULL,
  _employment_end_date date DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _profile_id <> auth.uid() AND NOT public.has_hr_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only HR may change another employee''s private details';
  END IF;
  -- employment dates are an HR decision, never self-service
  IF _profile_id = auth.uid() AND NOT public.has_hr_access(auth.uid())
     AND (_employment_start_date IS NOT NULL OR _employment_end_date IS NOT NULL) THEN
    RAISE EXCEPTION 'Only HR may set employment dates';
  END IF;
  IF length(COALESCE(_medical_notes, '')) > 2000 THEN
    RAISE EXCEPTION 'Medical notes must be 2000 characters or less';
  END IF;

  INSERT INTO public.employee_private_details AS e (
    profile_id, date_of_birth, medical_notes,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
    emergency_contact2_name, emergency_contact2_phone,
    clothing_size, shoe_size, drivers_license,
    employment_start_date, employment_end_date
  ) VALUES (
    _profile_id, _date_of_birth, NULLIF(btrim(COALESCE(_medical_notes,'')),''),
    NULLIF(btrim(COALESCE(_emergency_contact_name,'')),''),
    NULLIF(btrim(COALESCE(_emergency_contact_phone,'')),''),
    NULLIF(btrim(COALESCE(_emergency_contact_relation,'')),''),
    NULLIF(btrim(COALESCE(_emergency_contact2_name,'')),''),
    NULLIF(btrim(COALESCE(_emergency_contact2_phone,'')),''),
    NULLIF(btrim(COALESCE(_clothing_size,'')),''),
    NULLIF(btrim(COALESCE(_shoe_size,'')),''),
    NULLIF(btrim(COALESCE(_drivers_license,'')),''),
    _employment_start_date, _employment_end_date
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    date_of_birth = EXCLUDED.date_of_birth,
    medical_notes = EXCLUDED.medical_notes,
    emergency_contact_name = EXCLUDED.emergency_contact_name,
    emergency_contact_phone = EXCLUDED.emergency_contact_phone,
    emergency_contact_relation = EXCLUDED.emergency_contact_relation,
    emergency_contact2_name = EXCLUDED.emergency_contact2_name,
    emergency_contact2_phone = EXCLUDED.emergency_contact2_phone,
    clothing_size = EXCLUDED.clothing_size,
    shoe_size = EXCLUDED.shoe_size,
    drivers_license = EXCLUDED.drivers_license,
    employment_start_date = COALESCE(EXCLUDED.employment_start_date, e.employment_start_date),
    employment_end_date = COALESCE(EXCLUDED.employment_end_date, e.employment_end_date);

  INSERT INTO public.employee_private_access_log (profile_id, accessed_by, action, reason)
  VALUES (_profile_id, auth.uid(), 'write', NULLIF(btrim(COALESCE(_reason,'')),''));
END; $$;
REVOKE ALL ON FUNCTION public.upsert_employee_private_details(uuid, date, text, text, text, text, text, text, text, text, text, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_employee_private_details(uuid, date, text, text, text, text, text, text, text, text, text, date, date, text) TO authenticated;

-- 7. Audited deletion (right to erasure)
CREATE OR REPLACE FUNCTION public.delete_employee_private_details(_profile_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _profile_id <> auth.uid() AND NOT public.has_hr_access(auth.uid()) THEN
    RAISE EXCEPTION 'Only HR may delete another employee''s private details';
  END IF;

  DELETE FROM public.employee_private_details WHERE profile_id = _profile_id;

  INSERT INTO public.employee_private_access_log (profile_id, accessed_by, action, reason)
  VALUES (_profile_id, auth.uid(), 'delete', NULLIF(btrim(COALESCE(_reason,'')),''));
END; $$;
REVOKE ALL ON FUNCTION public.delete_employee_private_details(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_employee_private_details(uuid, text) TO authenticated;

-- 8. Move existing data across, then remove the sensitive columns from profiles
INSERT INTO public.employee_private_details (
  profile_id, date_of_birth, medical_notes,
  emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
  emergency_contact2_name, emergency_contact2_phone,
  clothing_size, shoe_size, drivers_license, employment_start_date
)
SELECT p.id, p.date_of_birth, p.medical_notes,
       p.emergency_contact_name, p.emergency_contact_phone, p.emergency_contact_relation,
       p.emergency_contact2_name, p.emergency_contact2_phone,
       p.clothing_size, p.shoe_size, p.drivers_license, p.employment_start_date
FROM public.profiles p
WHERE COALESCE(p.date_of_birth::text, p.medical_notes, p.emergency_contact_name, p.emergency_contact_phone,
               p.emergency_contact_relation, p.emergency_contact2_name, p.emergency_contact2_phone,
               p.clothing_size, p.shoe_size, p.drivers_license, p.employment_start_date::text) IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS medical_notes,
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_phone,
  DROP COLUMN IF EXISTS emergency_contact_relation,
  DROP COLUMN IF EXISTS emergency_contact2_name,
  DROP COLUMN IF EXISTS emergency_contact2_phone,
  DROP COLUMN IF EXISTS clothing_size,
  DROP COLUMN IF EXISTS shoe_size,
  DROP COLUMN IF EXISTS drivers_license,
  DROP COLUMN IF EXISTS employment_start_date;

-- 9. Nightly retention clean-up
SELECT cron.unschedule('purge-employee-private-details')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-employee-private-details');

SELECT cron.schedule(
  'purge-employee-private-details',
  '15 3 * * *',
  $cron$SELECT public.purge_expired_employee_private_details();$cron$
);