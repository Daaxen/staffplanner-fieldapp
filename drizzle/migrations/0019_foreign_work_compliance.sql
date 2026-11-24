ALTER TABLE public.installers ADD COLUMN IF NOT EXISTS home_country text;
COMMENT ON COLUMN public.installers.home_country IS 'ISO 3166-1 alpha-2 operational home/employment country used only for foreign-work comparison. NULL = not configured (counters NOT VERIFIED).';

CREATE OR REPLACE FUNCTION public.guard_installer_home_country()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.home_country IS DISTINCT FROM OLD.home_country THEN
    IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser') OR public.has_role(auth.uid(),'hr')) THEN
      RAISE EXCEPTION 'Endast admin eller HR kan ändra hemland';
    END IF;
    IF NEW.home_country IS NOT NULL AND NEW.home_country !~ '^[A-Z]{2}$' THEN
      RAISE EXCEPTION 'Hemland måste vara en tvåställig landskod';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_installer_home_country ON public.installers;
CREATE TRIGGER trg_guard_installer_home_country BEFORE UPDATE ON public.installers
  FOR EACH ROW EXECUTE FUNCTION public.guard_installer_home_country();
DROP TRIGGER IF EXISTS trg_audit_installer_home_country ON public.installers;
CREATE TRIGGER trg_audit_installer_home_country AFTER UPDATE OF home_country ON public.installers
  FOR EACH ROW WHEN (OLD.home_country IS DISTINCT FROM NEW.home_country)
  EXECUTE FUNCTION public.audit_row_change('installer_home_country', 'name', 'home_country');

-- Periods (manual presence / confirmed work)
CREATE TABLE public.foreign_work_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id uuid NOT NULL REFERENCES public.installers(id),
  project_id uuid REFERENCES public.projects(id),
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  kind text NOT NULL DEFAULT 'presence' CHECK (kind IN ('presence','work')),
  source text NOT NULL DEFAULT 'admin_confirmed' CHECK (source IN ('admin_confirmed','travel_record','approved_correction','imported_history','assignment')),
  verification_status text NOT NULL DEFAULT 'MANUALLY_CONFIRMED' CHECK (verification_status IN ('VERIFIED','DERIVED','MANUALLY_CONFIRMED','INSUFFICIENT_DATA','VOIDED')),
  notes text,
  voided_at timestamptz,
  void_reason text,
  corrects_id uuid REFERENCES public.foreign_work_periods(id),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at >= start_at)
);
CREATE INDEX ON public.foreign_work_periods(installer_id, country);
GRANT SELECT, INSERT, UPDATE ON public.foreign_work_periods TO authenticated;
GRANT ALL ON public.foreign_work_periods TO service_role;
ALTER TABLE public.foreign_work_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fw periods admin manage" ON public.foreign_work_periods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'));
CREATE POLICY "fw periods hr read" ON public.foreign_work_periods FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hr'));

-- Rules
CREATE TABLE public.foreign_work_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  countries text[] NOT NULL DEFAULT '{}',
  metric text NOT NULL CHECK (metric IN ('WORK_DAYS','PRESENCE_DAYS','CONTINUOUS_ASSIGNMENT_DURATION')),
  window_type text NOT NULL CHECK (window_type IN ('CALENDAR_YEAR','ROLLING_12_MONTHS','FIXED_DATE_RANGE','CONTINUOUS_ASSIGNMENT')),
  window_start date,
  window_end date,
  watch_threshold integer NOT NULL CHECK (watch_threshold > 0),
  review_threshold integer NOT NULL,
  critical_threshold integer NOT NULL,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  enabled boolean NOT NULL DEFAULT true,
  explanation text,
  internal_note text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (watch_threshold <= review_threshold AND review_threshold <= critical_threshold),
  CHECK (window_type <> 'FIXED_DATE_RANGE' OR (window_start IS NOT NULL AND window_end IS NOT NULL AND window_end >= window_start))
);
GRANT SELECT, INSERT, UPDATE ON public.foreign_work_rules TO authenticated;
GRANT ALL ON public.foreign_work_rules TO service_role;
ALTER TABLE public.foreign_work_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fw rules admin manage" ON public.foreign_work_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'));
CREATE POLICY "fw rules staff read" ON public.foreign_work_rules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'installer'));

-- Compliance document metadata
CREATE TABLE public.foreign_work_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id uuid NOT NULL REFERENCES public.installers(id),
  doc_type text NOT NULL CHECK (doc_type IN ('A1','POSTING_NOTIFICATION','WORK_PERMIT','OTHER_COMPLIANCE_DOCUMENT')),
  countries text[] NOT NULL DEFAULT '{}',
  valid_from date,
  valid_to date,
  status text NOT NULL DEFAULT 'NOT_VERIFIED' CHECK (status IN ('VALID','EXPIRING','EXPIRED','MISSING','NOT_REQUIRED','NOT_VERIFIED')),
  reference_number text,
  notes text,
  document_id uuid REFERENCES public.documents(id),
  voided_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.foreign_work_documents TO authenticated;
GRANT ALL ON public.foreign_work_documents TO service_role;
ALTER TABLE public.foreign_work_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fw docs admin manage" ON public.foreign_work_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superuser'));
CREATE POLICY "fw docs hr read" ON public.foreign_work_documents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'hr'));

CREATE OR REPLACE FUNCTION public.foreign_work_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); NEW.updated_by := auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER trg_fw_periods_touch BEFORE UPDATE ON public.foreign_work_periods FOR EACH ROW EXECUTE FUNCTION public.foreign_work_touch();
CREATE TRIGGER trg_fw_rules_touch BEFORE UPDATE ON public.foreign_work_rules FOR EACH ROW EXECUTE FUNCTION public.foreign_work_touch();
CREATE TRIGGER trg_fw_docs_touch BEFORE UPDATE ON public.foreign_work_documents FOR EACH ROW EXECUTE FUNCTION public.foreign_work_touch();

-- No hard delete of compliance evidence: void instead
CREATE OR REPLACE FUNCTION public.foreign_work_no_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Utlandsposter raderas inte – makulera i stället'; END $$;
CREATE TRIGGER trg_fw_periods_nodel BEFORE DELETE ON public.foreign_work_periods FOR EACH ROW EXECUTE FUNCTION public.foreign_work_no_delete();
CREATE TRIGGER trg_fw_docs_nodel BEFORE DELETE ON public.foreign_work_documents FOR EACH ROW EXECUTE FUNCTION public.foreign_work_no_delete();

CREATE TRIGGER trg_audit_fw_periods AFTER INSERT OR DELETE ON public.foreign_work_periods FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_period','country');
CREATE TRIGGER trg_audit_fw_periods_upd AFTER UPDATE ON public.foreign_work_periods FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_period','country','country','start_at','end_at','kind','source','verification_status','voided_at','void_reason','project_id');
CREATE TRIGGER trg_audit_fw_rules AFTER INSERT OR DELETE ON public.foreign_work_rules FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_rule','name');
CREATE TRIGGER trg_audit_fw_rules_upd AFTER UPDATE ON public.foreign_work_rules FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_rule','name','name','countries','metric','window_type','window_start','window_end','watch_threshold','review_threshold','critical_threshold','effective_from','effective_to','enabled','explanation');
CREATE TRIGGER trg_audit_fw_docs AFTER INSERT OR DELETE ON public.foreign_work_documents FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_document','doc_type');
CREATE TRIGGER trg_audit_fw_docs_upd AFTER UPDATE ON public.foreign_work_documents FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_document','doc_type','doc_type','countries','valid_from','valid_to','status','reference_number','voided_at','document_id');

-- Country name (as stored on orders) -> ISO
CREATE OR REPLACE FUNCTION public.country_iso(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(trim(coalesce(_name,'')))
    WHEN 'sverige' THEN 'SE' WHEN 'norge' THEN 'NO' WHEN 'finland' THEN 'FI' WHEN 'danmark' THEN 'DK'
    WHEN 'tyskland' THEN 'DE' WHEN 'island' THEN 'IS' WHEN 'estland' THEN 'EE' WHEN 'lettland' THEN 'LV'
    WHEN 'litauen' THEN 'LT' WHEN 'polen' THEN 'PL' WHEN 'nederländerna' THEN 'NL' WHEN 'belgien' THEN 'BE'
    WHEN 'frankrike' THEN 'FR' WHEN 'storbritannien' THEN 'GB' WHEN 'spanien' THEN 'ES' WHEN 'italien' THEN 'IT'
    WHEN 'österrike' THEN 'AT' WHEN 'schweiz' THEN 'CH' WHEN 'irland' THEN 'IE' WHEN 'portugal' THEN 'PT'
    ELSE CASE WHEN upper(trim(_name)) ~ '^[A-Z]{2}$' THEN upper(trim(_name)) ELSE NULL END END
$$;

-- Authoritative day-level facts. One row per installer/country/day.
CREATE OR REPLACE FUNCTION public.foreign_work_days(_from date, _to date, _installer_id uuid DEFAULT NULL)
RETURNS TABLE(installer_id uuid, country text, day date, is_work boolean, is_presence boolean,
              work_source text, presence_source text, verification text, project_ids uuid[], conflict boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_all boolean;
  v_self uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_all := public.has_role(v_uid,'admin') OR public.has_role(v_uid,'superuser') OR public.has_role(v_uid,'hr');
  IF NOT v_all THEN
    IF NOT public.has_role(v_uid,'installer') THEN RETURN; END IF;
    v_self := public.current_installer_id();
    IF v_self IS NULL OR (_installer_id IS NOT NULL AND _installer_id <> v_self) THEN RETURN; END IF;
    _installer_id := v_self;
  END IF;
  IF _to - _from > 1100 THEN RAISE EXCEPTION 'Period för lång'; END IF;

  RETURN QUERY
  WITH inst AS (
    SELECT i.id, i.home_country FROM public.installers i
    WHERE i.home_country IS NOT NULL AND (_installer_id IS NULL OR i.id = _installer_id)
      AND (NOT i.sandbox OR NOT v_all OR _installer_id IS NOT NULL)
  ),
  te AS (
    SELECT t.installer_id, public.country_iso(p.country) AS country, t.entry_date AS day,
           bool_or(p.status = 'Completed') AS completed, array_agg(DISTINCT p.id) AS pids
    FROM public.time_entries t JOIN public.projects p ON p.id = t.project_id JOIN inst ON inst.id = t.installer_id
    WHERE t.entry_date BETWEEN _from AND _to AND t.hours > 0
      AND public.country_iso(p.country) IS NOT NULL AND public.country_iso(p.country) <> inst.home_country
    GROUP BY 1,2,3
  ),
  per AS (
    SELECT fp.installer_id, fp.country, d::date AS day, fp.kind, fp.source, fp.verification_status, fp.project_id
    FROM public.foreign_work_periods fp JOIN inst ON inst.id = fp.installer_id
    CROSS JOIN LATERAL generate_series((fp.start_at AT TIME ZONE 'Europe/Stockholm')::date,
                                       (fp.end_at AT TIME ZONE 'Europe/Stockholm')::date, interval '1 day') d
    WHERE fp.voided_at IS NULL AND fp.verification_status <> 'VOIDED' AND fp.country <> inst.home_country
      AND d::date BETWEEN _from AND _to
  ),
  keys AS (
    SELECT te.installer_id, te.country, te.day FROM te
    UNION SELECT per.installer_id, per.country, per.day FROM per
  ),
  dom AS ( -- day also has domestic time or another foreign country -> conflict flag
    SELECT k.installer_id, k.day, count(DISTINCT k.country) AS n FROM keys k GROUP BY 1,2
  )
  SELECT k.installer_id, k.country, k.day,
    (te.day IS NOT NULL OR EXISTS (SELECT 1 FROM per x WHERE x.installer_id=k.installer_id AND x.country=k.country AND x.day=k.day AND x.kind='work')) AS is_work,
    true AS is_presence,
    CASE WHEN EXISTS (SELECT 1 FROM per x WHERE x.installer_id=k.installer_id AND x.country=k.country AND x.day=k.day AND x.kind='work') THEN 'manual_work'
         WHEN te.day IS NOT NULL THEN CASE WHEN te.completed THEN 'time_entry_completed' ELSE 'time_entry' END END,
    CASE WHEN EXISTS (SELECT 1 FROM per x WHERE x.installer_id=k.installer_id AND x.country=k.country AND x.day=k.day AND x.kind='presence') THEN 'presence_period'
         ELSE 'work_day' END,
    CASE WHEN EXISTS (SELECT 1 FROM per x WHERE x.installer_id=k.installer_id AND x.country=k.country AND x.day=k.day AND x.verification_status IN ('VERIFIED','MANUALLY_CONFIRMED')) THEN 'MANUALLY_CONFIRMED'
         WHEN te.completed THEN 'VERIFIED' ELSE 'DERIVED' END,
    (SELECT array_agg(DISTINCT u) FROM unnest(coalesce(te.pids,'{}') || coalesce((SELECT array_agg(x.project_id) FROM per x WHERE x.installer_id=k.installer_id AND x.country=k.country AND x.day=k.day AND x.project_id IS NOT NULL),'{}')) u),
    (dom.n > 1)
  FROM keys k
  LEFT JOIN te ON te.installer_id=k.installer_id AND te.country=k.country AND te.day=k.day
  JOIN dom ON dom.installer_id=k.installer_id AND dom.day=k.day;
END $$;
REVOKE ALL ON FUNCTION public.foreign_work_days(date,date,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foreign_work_days(date,date,uuid) TO authenticated;