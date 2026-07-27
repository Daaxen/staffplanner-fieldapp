CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'reminders-scan-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://piubkkipultepevxbxuv.supabase.co/functions/v1/reminders-scan',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpdWJra2lwdWx0ZXBldnhieHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTU4NTQsImV4cCI6MjA4ODQ3MTg1NH0.-eaJ0kXapz0bV80Ucb3lyGrYgnW383664whdyoEFRKg"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);