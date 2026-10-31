CREATE OR REPLACE FUNCTION public.freeze_project_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := to_jsonb(OLD);
BEGIN
  IF v_new->>'project_ref' IS DISTINCT FROM v_old->>'project_ref' THEN
    RAISE EXCEPTION 'project_ref is an immutable historical snapshot';
  END IF;
  IF v_new->>'project_name' IS DISTINCT FROM v_old->>'project_name' THEN
    RAISE EXCEPTION 'project_name is an immutable historical snapshot';
  END IF;
  IF v_new->>'project_id' IS DISTINCT FROM v_old->>'project_id' THEN
    RAISE EXCEPTION 'project_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;