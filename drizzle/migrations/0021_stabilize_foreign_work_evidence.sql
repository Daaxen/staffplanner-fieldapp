ALTER TABLE public.projects ADD COLUMN country_code text, ADD COLUMN country_provenance text NOT NULL DEFAULT 'UNKNOWN' CHECK (country_provenance IN ('CONFIRMED','DERIVED','DEFAULTED','UNKNOWN'));
ALTER TABLE public.recurring_order_series ADD COLUMN country_code text, ADD COLUMN country_provenance text NOT NULL DEFAULT 'UNKNOWN' CHECK (country_provenance IN ('CONFIRMED','DERIVED','DEFAULTED','UNKNOWN'));
ALTER TABLE public.foreign_work_periods ADD COLUMN home_country_snapshot text;
COMMENT ON COLUMN public.projects.country_code IS 'Canonical ISO destination for compliance; existing country remains the Swedish per-diem display label. No historical backfill.';
COMMENT ON COLUMN public.projects.country_provenance IS 'UNKNOWN for legacy rows; defaults and address guesses are not verified destination evidence.';

CREATE OR REPLACE FUNCTION public.country_iso(_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN upper(btrim(_name)) = ANY(string_to_array('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW',' ')) THEN upper(btrim(_name))
 ELSE ('{"sverige":"SE","sweden":"SE","norge":"NO","norway":"NO","finland":"FI","danmark":"DK","denmark":"DK","tyskland":"DE","germany":"DE","island":"IS","iceland":"IS","estland":"EE","estonia":"EE","lettland":"LV","latvia":"LV","litauen":"LT","lithuania":"LT","polen":"PL","poland":"PL","nederländerna":"NL","netherlands":"NL","holland":"NL","belgien":"BE","belgium":"BE","frankrike":"FR","france":"FR","storbritannien":"GB","storbritannien och nordirland":"GB","united kingdom":"GB","united kingdom of great britain and northern ireland":"GB","great britain":"GB","britain":"GB","uk":"GB","spanien":"ES","spain":"ES","italien":"IT","italy":"IT","österrike":"AT","austria":"AT","schweiz":"CH","switzerland":"CH","irland":"IE","ireland":"IE","portugal":"PT","usa":"US","united states":"US","united states of america":"US","amerika":"US","tjeckien":"CZ","czechia":"CZ","czech republic":"CZ","grekland":"GR","greece":"GR"}'::jsonb ->> lower(btrim(_name))) END
$$;
CREATE OR REPLACE FUNCTION public.foreign_destination_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.country IS DISTINCT FROM OLD.country OR NEW.country_code IS DISTINCT FROM OLD.country_code THEN
   NEW.country_code := public.country_iso(COALESCE(NEW.country_code,NEW.country));
   IF NEW.country_code IS NULL THEN NEW.country_provenance := 'UNKNOWN'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fw_project_destination BEFORE INSERT OR UPDATE OF country,country_code,country_provenance ON public.projects FOR EACH ROW EXECUTE FUNCTION public.foreign_destination_guard();
CREATE TRIGGER fw_project_country_audit AFTER UPDATE OF country,country_code,country_provenance ON public.projects FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_project_country','name','country','country_code','country_provenance');

CREATE TABLE public.foreign_work_country_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), time_entry_id uuid NOT NULL, installer_id uuid NOT NULL REFERENCES public.installers(id), project_id uuid NOT NULL REFERENCES public.projects(id), destination_country text NOT NULL, home_country text NOT NULL, reason text NOT NULL, corrects_id uuid REFERENCES public.foreign_work_country_evidence(id), voided_at timestamptz, created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), CHECK(public.country_iso(destination_country)=destination_country), CHECK(public.country_iso(home_country)=home_country)
);
GRANT SELECT ON public.foreign_work_country_evidence TO authenticated;
GRANT ALL ON public.foreign_work_country_evidence TO service_role;
ALTER TABLE public.foreign_work_country_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fw country evidence scoped read" ON public.foreign_work_country_evidence FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR (public.has_role(auth.uid(),'installer') AND installer_id=public.current_installer_id()));
CREATE UNIQUE INDEX fw_country_active_evidence ON public.foreign_work_country_evidence(time_entry_id) WHERE voided_at IS NULL;
CREATE TRIGGER fw_country_evidence_audit AFTER INSERT OR UPDATE ON public.foreign_work_country_evidence FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_country_evidence','destination_country');
CREATE OR REPLACE FUNCTION public.foreign_country_evidence_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Landbevis raderas inte'; END IF;
 IF (to_jsonb(NEW)-'voided_at') IS DISTINCT FROM (to_jsonb(OLD)-'voided_at') OR OLD.voided_at IS NOT NULL OR NEW.voided_at IS NULL THEN RAISE EXCEPTION 'Landbevis ändras genom auditerad rättning'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fw_country_evidence_immutable BEFORE UPDATE OR DELETE ON public.foreign_work_country_evidence FOR EACH ROW EXECUTE FUNCTION public.foreign_country_evidence_guard();
CREATE OR REPLACE FUNCTION public.capture_foreign_country_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.country_provenance='CONFIRMED' AND NEW.country_code IS NOT NULL THEN
 INSERT INTO public.foreign_work_country_evidence(time_entry_id,installer_id,project_id,destination_country,home_country,reason)
 SELECT t.id,t.installer_id,NEW.id,NEW.country_code,i.home_country,'Ny slutförd order med uttryckligen bekräftat land' FROM public.time_entries t JOIN public.installers i ON i.id=t.installer_id
 WHERE t.project_id=NEW.id AND t.hours>0 AND public.country_iso(i.home_country)=i.home_country AND NOT EXISTS(SELECT 1 FROM public.foreign_work_country_evidence e WHERE e.time_entry_id=t.id AND e.voided_at IS NULL);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER fw_capture_completed_country AFTER UPDATE OF status ON public.projects FOR EACH ROW EXECUTE FUNCTION public.capture_foreign_country_evidence();
CREATE OR REPLACE FUNCTION public.correct_foreign_country_evidence(_id uuid,_country text,_home text,_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e public.foreign_work_country_evidence; v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 IF length(btrim(COALESCE(_reason,'')))<3 OR public.country_iso(_country) IS NULL OR public.country_iso(_home) IS NULL THEN RAISE EXCEPTION 'Land och rättningsskäl krävs'; END IF;
 SELECT * INTO e FROM public.foreign_work_country_evidence WHERE id=_id AND voided_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aktivt landbevis saknas'; END IF;
 UPDATE public.foreign_work_country_evidence SET voided_at=now() WHERE id=e.id;
 INSERT INTO public.foreign_work_country_evidence(time_entry_id,installer_id,project_id,destination_country,home_country,reason,corrects_id) VALUES(e.time_entry_id,e.installer_id,e.project_id,public.country_iso(_country),public.country_iso(_home),_reason,e.id) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.correct_foreign_country_evidence(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.correct_foreign_country_evidence(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.foreign_period_evidence_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
 NEW.country:=public.country_iso(NEW.country);
 IF NEW.country IS NULL THEN RAISE EXCEPTION 'Okänt land'; END IF;
 SELECT i.home_country INTO NEW.home_country_snapshot FROM public.installers i WHERE i.id=NEW.installer_id;
 IF public.country_iso(NEW.home_country_snapshot) IS NULL THEN NEW.verification_status:='INSUFFICIENT_DATA'; END IF;
 ELSE
 IF OLD.verification_status IN ('VERIFIED','MANUALLY_CONFIRMED') AND (to_jsonb(NEW)-ARRAY['voided_at','void_reason','verification_status','updated_at','updated_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['voided_at','void_reason','verification_status','updated_at','updated_by']) THEN RAISE EXCEPTION 'Bekräftad evidens korrigeras med en ny länkad post'; END IF;
 IF OLD.home_country_snapshot IS DISTINCT FROM NEW.home_country_snapshot THEN RAISE EXCEPTION 'Fryst hemland får inte ändras'; END IF;
 IF OLD.verification_status IN ('VERIFIED','MANUALLY_CONFIRMED') AND NEW.verification_status IS DISTINCT FROM OLD.verification_status AND NOT (NEW.verification_status='VOIDED' AND NEW.voided_at IS NOT NULL AND length(btrim(COALESCE(NEW.void_reason,'')))>=3) THEN RAISE EXCEPTION 'Makulering kräver skäl'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fw_period_evidence_guard BEFORE INSERT OR UPDATE ON public.foreign_work_periods FOR EACH ROW EXECUTE FUNCTION public.foreign_period_evidence_guard();
DROP TRIGGER trg_audit_fw_periods_upd ON public.foreign_work_periods;
CREATE TRIGGER trg_audit_fw_periods_upd AFTER UPDATE ON public.foreign_work_periods FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_period','country','installer_id','country','home_country_snapshot','start_at','end_at','kind','source','verification_status','voided_at','void_reason','project_id','notes','corrects_id');
DROP TRIGGER trg_audit_fw_rules_upd ON public.foreign_work_rules;
CREATE TRIGGER trg_audit_fw_rules_upd AFTER UPDATE ON public.foreign_work_rules FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_rule','name','name','countries','metric','window_type','window_start','window_end','watch_threshold','review_threshold','critical_threshold','effective_from','effective_to','enabled','explanation','internal_note');
DROP TRIGGER trg_audit_fw_docs_upd ON public.foreign_work_documents;
CREATE TRIGGER trg_audit_fw_docs_upd AFTER UPDATE ON public.foreign_work_documents FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('foreign_work_document','doc_type','installer_id','doc_type','countries','valid_from','valid_to','status','reference_number','voided_at','document_id','notes');
REVOKE SELECT ON public.foreign_work_rules FROM authenticated;
GRANT SELECT(id,name,countries,metric,window_type,window_start,window_end,watch_threshold,review_threshold,critical_threshold,effective_from,effective_to,enabled,explanation,created_at) ON public.foreign_work_rules TO authenticated;
CREATE OR REPLACE FUNCTION public.foreign_work_rule_data(_internal boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'installer')) THEN RAISE EXCEPTION 'Staff only' USING ERRCODE='42501'; END IF;
 IF _internal AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(CASE WHEN _internal THEN to_jsonb(r) ELSE to_jsonb(r)-ARRAY['internal_note','created_by','updated_by','updated_at'] END ORDER BY r.created_at),'[]') INTO v FROM public.foreign_work_rules r;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.foreign_work_rule_data(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.foreign_work_rule_data(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.foreign_work_installers() RETURNS TABLE(id uuid,name text,type text,home_country text,sandbox boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'installer')) THEN RAISE EXCEPTION 'Staff only' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT i.id,i.name,i.type,i.home_country,i.sandbox FROM public.installers i WHERE (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR i.id=public.current_installer_id()) AND (NOT i.sandbox OR i.id=public.current_installer_id());
END $$;
REVOKE ALL ON FUNCTION public.foreign_work_installers() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.foreign_work_installers() TO authenticated;
CREATE OR REPLACE FUNCTION public.log_foreign_work_export(_metadata jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')) THEN RAISE EXCEPTION 'Report access required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.audit_log(actor_id,entity_type,entity_id,action,new_values,reason,actor_type,source) VALUES(auth.uid(),'foreign_work_export',gen_random_uuid()::text,'export',_metadata,'Utlandsrapport XLSX',CASE WHEN public.has_role(auth.uid(),'admin') THEN 'admin' ELSE 'user' END,'app');
END $$;
REVOKE ALL ON FUNCTION public.log_foreign_work_export(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.log_foreign_work_export(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.foreign_work_days(_from date,_to date,_installer_id uuid DEFAULT NULL)
RETURNS TABLE(installer_id uuid,country text,day date,is_work boolean,is_presence boolean,work_source text,presence_source text,verification text,project_ids uuid[],conflict boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_all boolean; v_self uuid;
BEGIN
 IF v_uid IS NULL THEN RETURN; END IF;
 v_all:=public.has_role(v_uid,'admin') OR public.has_role(v_uid,'hr');
 IF NOT v_all THEN
 IF NOT public.has_role(v_uid,'installer') THEN RETURN; END IF;
 v_self:=public.current_installer_id(); IF v_self IS NULL OR (_installer_id IS NOT NULL AND _installer_id<>v_self) THEN RETURN; END IF; _installer_id:=v_self;
 END IF;
 IF _from IS NULL OR _to IS NULL OR _to<_from OR _to-_from>1100 THEN RAISE EXCEPTION 'Ogiltig period (högst 1101 dagar)'; END IF;
 RETURN QUERY WITH inst AS (SELECT i.id,i.home_country FROM public.installers i WHERE (_installer_id IS NULL OR i.id=_installer_id) AND (NOT i.sandbox OR NOT v_all OR _installer_id IS NOT NULL)),
 raw AS (SELECT t.installer_id,t.entry_date AS day,t.project_id,t.hours,t.travel_hours,COALESCE(e.destination_country,p.country_code,public.country_iso(p.country)) AS country,COALESCE(e.home_country,i.home_country) AS home,e.id IS NOT NULL AS frozen,p.country_provenance,p.status FROM public.time_entries t JOIN inst i ON i.id=t.installer_id LEFT JOIN public.projects p ON p.id=t.project_id LEFT JOIN public.foreign_work_country_evidence e ON e.time_entry_id=t.id AND e.voided_at IS NULL WHERE t.entry_date BETWEEN _from AND LEAST(_to,current_date) AND (t.hours>0 OR t.travel_hours>0)),
 te AS (SELECT r.installer_id,CASE WHEN r.country IS NULL OR r.home IS NULL OR r.project_id IS NULL THEN 'UNKNOWN' ELSE r.country END AS country,r.day,bool_or(r.hours>0 AND r.country IS NOT NULL AND r.home IS NOT NULL AND r.project_id IS NOT NULL) AS work,bool_and(r.frozen) AS verified,bool_or(r.status='completed') AS completed,array_agg(DISTINCT r.project_id) FILTER(WHERE r.project_id IS NOT NULL) AS pids FROM raw r WHERE r.country IS NULL OR r.home IS NULL OR r.project_id IS NULL OR r.country<>r.home GROUP BY 1,2,3),
 per AS (SELECT fp.installer_id,fp.country,d::date AS day,fp.kind,fp.verification_status,fp.project_id FROM public.foreign_work_periods fp JOIN inst i ON i.id=fp.installer_id CROSS JOIN LATERAL generate_series((fp.start_at AT TIME ZONE 'Europe/Stockholm')::date,LEAST((fp.end_at AT TIME ZONE 'Europe/Stockholm')::date,current_date),interval '1 day') d WHERE fp.voided_at IS NULL AND fp.verification_status<>'VOIDED' AND fp.country<>COALESCE(fp.home_country_snapshot,i.home_country,'') AND d::date BETWEEN _from AND LEAST(_to,current_date)),
 keys AS(SELECT t.installer_id,t.country,t.day FROM te t UNION SELECT p.installer_id,p.country,p.day FROM per p),
 agg AS(SELECT k.installer_id,k.country,k.day,te.work,te.verified,te.completed,te.pids,bool_or(p.kind='work' AND p.verification_status IN ('VERIFIED','MANUALLY_CONFIRMED')) AS manual_work,bool_or(p.kind='presence' AND p.verification_status IN ('VERIFIED','MANUALLY_CONFIRMED')) AS confirmed_presence,bool_or(p.kind='presence') AS any_presence,bool_or(p.verification_status='INSUFFICIENT_DATA') AS insufficient FROM keys k LEFT JOIN te ON te.installer_id=k.installer_id AND te.country=k.country AND te.day=k.day LEFT JOIN per p ON p.installer_id=k.installer_id AND p.country=k.country AND p.day=k.day GROUP BY k.installer_id,k.country,k.day,te.work,te.verified,te.completed,te.pids)
 SELECT a.installer_id,a.country,a.day,COALESCE(a.work,false) OR COALESCE(a.manual_work,false),COALESCE(a.work,false) OR COALESCE(a.manual_work,false) OR COALESCE(a.any_presence,false),CASE WHEN a.manual_work THEN 'manual_work' WHEN a.work AND a.verified THEN 'time_entry_completed' WHEN a.work THEN 'time_entry' ELSE 'unresolved_time' END,CASE WHEN a.confirmed_presence THEN 'presence_period' WHEN a.any_presence THEN 'derived_presence_period' WHEN a.work OR a.manual_work THEN 'work_day' ELSE NULL END,CASE WHEN a.country='UNKNOWN' OR a.insufficient THEN 'INSUFFICIENT_DATA' WHEN a.manual_work OR a.confirmed_presence THEN 'MANUALLY_CONFIRMED' WHEN a.verified THEN 'VERIFIED' ELSE 'DERIVED' END,(SELECT array_agg(DISTINCT u) FROM unnest(COALESCE(a.pids,'{}')||COALESCE((SELECT array_agg(p.project_id) FROM per p WHERE p.installer_id=a.installer_id AND p.country=a.country AND p.day=a.day AND p.project_id IS NOT NULL),'{}')) u),EXISTS(SELECT 1 FROM keys k WHERE k.installer_id=a.installer_id AND k.day=a.day AND k.country<>a.country AND k.country<>'UNKNOWN') FROM agg a;
END $$;
REVOKE ALL ON FUNCTION public.foreign_work_days(date,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.foreign_work_days(date,date,uuid) TO authenticated;