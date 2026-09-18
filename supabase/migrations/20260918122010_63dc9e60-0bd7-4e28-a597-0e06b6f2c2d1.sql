-- Idempotency ledger for scheduled jobs: one row per job per time bucket.
CREATE TABLE IF NOT EXISTS public.job_runs (
  job text NOT NULL,
  bucket timestamptz NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (job, bucket)
);

GRANT SELECT ON public.job_runs TO authenticated;
GRANT ALL ON public.job_runs TO service_role;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read job runs" ON public.job_runs;
CREATE POLICY "admins read job runs" ON public.job_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- (Re)creates the reminders-scan cron job from Vault-stored configuration.
-- No URL and no secret is ever written into migration history: both are read
-- from Vault at schedule time, so the same migration is safe in dev, staging
-- and production.
CREATE OR REPLACE FUNCTION public.schedule_reminders_scan(_cron text DEFAULT '*/15 * * * *')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_job text := 'reminders-scan';
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'project_functions_url';
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN 'skipped: vault secrets project_functions_url / reminders_cron_secret are not set in this environment';
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = v_job;

  PERFORM cron.schedule(
    v_job,
    _cron,
    format(
      $cmd$SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret')
        ),
        body := jsonb_build_object('scheduled_at', now())
      );$cmd$,
      rtrim(v_url, '/') || '/reminders-scan'
    )
  );

  RETURN 'scheduled ' || v_job || ' (' || _cron || ')';
END; $$;

REVOKE ALL ON FUNCTION public.schedule_reminders_scan(text) FROM PUBLIC, anon, authenticated;

-- Retire the old schedule that carried a hardcoded URL and the public anon key.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'reminders-scan-every-15min';
EXCEPTION WHEN others THEN NULL;
END $$;