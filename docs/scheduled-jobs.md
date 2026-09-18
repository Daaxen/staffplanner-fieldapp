# Scheduled jobs: reminders-scan

## How it is protected

- The cron job calls `POST /functions/v1/reminders-scan` with an `x-cron-secret`
  header. The value is stored in **Supabase Vault** (`reminders_cron_secret`) and
  as an **edge function secret** (`REMINDERS_CRON_SECRET`). It never appears in
  migration files, application code or the repository.
- The function compares the header against the server-side secret using a
  constant-time comparison. Alternatively a **verified admin JWT** is accepted so
  an admin can trigger a run manually.
- The public anon key is *not* accepted as proof of trust. A request carrying
  only the anon key (or nothing) gets `401`; a signed-in non-admin gets `403`.
- `reminders-notify` is protected with the same guard, so nobody can push
  notifications by calling it directly.

## Environment safety

`public.schedule_reminders_scan(cron text default '*/15 * * * *')` builds the job
from Vault values:

| Vault secret            | Meaning                                              |
| ----------------------- | ---------------------------------------------------- |
| `project_functions_url` | Base URL of this environment's edge functions        |
| `reminders_cron_secret` | Shared secret sent as `x-cron-secret`                |

If either secret is missing (a fresh dev or staging database), the function
returns `skipped: ...` and schedules nothing — the migration is safe to run in
any environment.

## Setting up a new environment

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'project_functions_url');
select vault.create_secret('<random 64 hex chars>', 'reminders_cron_secret');
select public.schedule_reminders_scan();
```

Store the same random value as the `REMINDERS_CRON_SECRET` edge function secret.

## Rotating the secret

1. Generate a new value: `openssl rand -hex 32`.
2. Update the edge function secret `REMINDERS_CRON_SECRET`.
3. Update the vault value and re-schedule so the job sends the new header:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'reminders_cron_secret'),
  '<new value>'
);
select public.schedule_reminders_scan();
```

Because the cron command reads the secret from Vault at execution time, step 3
also covers redeployment — no migration and no code change is needed. Changing
the schedule is `select public.schedule_reminders_scan('*/30 * * * *');`, and
`select cron.unschedule('reminders-scan');` disables it.

## Duplicate protection

- Each run claims a row in `public.job_runs` keyed on the job name and a
  15-minute bucket. A second trigger inside the same window exits immediately.
- `reminders-notify` refuses to notify the same reminder again within 4 hours
  (`last_notified_at`), so retries and overlapping runs cannot spam installers.
- Run history (start, finish, counts) is readable by admins in `job_runs`.
