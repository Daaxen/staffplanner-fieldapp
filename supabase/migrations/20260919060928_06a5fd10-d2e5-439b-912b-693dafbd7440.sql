-- 1. Extend audit_log with richer attribution (actor_id stays nullable)
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS actor_name text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS correlation_id text;

ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_type_valid;
ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_type_valid
  CHECK (actor_type IN ('user','admin','service','system','cron','migration'));

-- 2. Preserve history: classify existing rows (immutability trigger lifted only
--    for this one-time backfill, then restored)
ALTER TABLE public.audit_log DISABLE TRIGGER USER;
UPDATE public.audit_log SET actor_type = 'user', source = 'database' WHERE actor_id IS NOT NULL;
UPDATE public.audit_log SET actor_type = 'system', source = 'database' WHERE actor_id IS NULL;
ALTER TABLE public.audit_log ENABLE TRIGGER USER;

-- 3. Indexes for actor_type and correlation_id
CREATE INDEX IF NOT EXISTS audit_log_actor_type_idx ON public.audit_log (actor_type, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_correlation_idx ON public.audit_log (correlation_id) WHERE correlation_id IS NOT NULL;

-- 4. Rebuild audit_row_change() with actor classification
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entity text := TG_ARGV[0];
  v_label_col text := NULLIF(TG_ARGV[1], '');
  v_old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  v_tracked text[] := TG_ARGV[2:array_length(TG_ARGV, 1) - 1];
  v_old_diff jsonb := '{}'::jsonb;
  v_new_diff jsonb := '{}'::jsonb;
  v_id text;
  v_label text;
  v_reason text;
  v_actor uuid := auth.uid();
  v_actor_type text := NULLIF(current_setting('app.actor_type', true), '');
  v_actor_name text := NULLIF(current_setting('app.actor_name', true), '');
  v_source text := NULLIF(current_setting('app.source', true), '');
  v_correlation text := NULLIF(current_setting('app.correlation_id', true), '');
  c text;
BEGIN
  v_id := COALESCE(v_new->>'id', v_old->>'id', v_new->>'project_id', v_old->>'project_id', '');
  IF v_label_col IS NOT NULL THEN
    v_label := COALESCE(v_new->>v_label_col, v_old->>v_label_col);
  END IF;
  v_reason := COALESCE(v_new->>'override_reason', v_new->>'reason', v_new->>'note');

  IF TG_OP = 'UPDATE' THEN
    IF array_length(v_tracked, 1) IS NULL THEN
      v_tracked := ARRAY(SELECT jsonb_object_keys(v_new));
    END IF;
    FOREACH c IN ARRAY v_tracked LOOP
      IF v_old->c IS DISTINCT FROM v_new->c THEN
        v_old_diff := v_old_diff || jsonb_build_object(c, v_old->c);
        v_new_diff := v_new_diff || jsonb_build_object(c, v_new->c);
      END IF;
    END LOOP;
    IF v_old_diff = '{}'::jsonb THEN
      RETURN NULL; -- nothing we care about changed
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_new_diff := v_new;
  ELSE
    v_old_diff := v_old;
  END IF;

  -- Actor classification. Callers (cron SQL, edge functions, migrations) may
  -- override via SET app.actor_type / app.actor_name / app.source / app.correlation_id.
  IF v_actor_type IS NULL THEN
    IF v_actor IS NOT NULL THEN
      v_actor_type := CASE WHEN public.has_role(v_actor, 'admin') THEN 'admin' ELSE 'user' END;
    ELSIF current_user = 'service_role' THEN
      v_actor_type := 'service';
    ELSE
      v_actor_type := 'system';
    END IF;
  END IF;
  IF v_actor_name IS NULL THEN
    v_actor_name := COALESCE(auth.jwt()->>'email', current_user);
  END IF;
  IF v_source IS NULL THEN
    v_source := CASE
      WHEN v_actor_type IN ('user', 'admin') THEN 'app'
      WHEN v_actor_type = 'service' THEN 'edge_function'
      ELSE 'database'
    END;
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_type, actor_name, source, correlation_id,
                                entity_type, entity_id, entity_label, action,
                                old_values, new_values, reason)
  VALUES (v_actor, v_actor_type, v_actor_name, v_source, v_correlation,
          v_entity, v_id, v_label,
          lower(CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END),
          NULLIF(v_old_diff, '{}'::jsonb), NULLIF(v_new_diff, '{}'::jsonb), v_reason);
  RETURN NULL;
END;
$function$;