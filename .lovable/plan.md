## Goal
Nag installers who haven't closed an order + logged time/mileage/cost by the morning after the project's end date. Escalate fast (same day) to admin if still nothing.

## Trigger & escalation ladder
An order is "delinquent" when, after its end date, any of these are still missing:
- Status not `completed`
- Zero time entries for this project by this installer
- Zero expense entries (any category, incl. mileage) for this project by this installer

Ladder (all times local, from the project's end date at 08:00 next day = T0):
- **T+0h** – silent push + in-app banner + Reminders inbox row (gentle)
- **T+4h** – push + banner (urgent tone, red)
- **T+8h** – admin alert (email-style in-app + push to admins) + installer still sees banner

Once the installer completes the order and logs at least one time + one expense entry (or explicitly marks "no cost / no mileage"), the reminder resolves and escalation stops.

## Data model (Lovable Cloud, new tables)

```text
reminders
  id, project_id, installer_id
  triggered_at (timestamptz, = end_date + 1 day 08:00)
  level: 'gentle' | 'urgent' | 'escalated'
  status: 'open' | 'resolved' | 'dismissed'
  resolved_at, last_notified_at
  missing: jsonb { completion:bool, time:bool, expense:bool }

reminder_events           -- audit trail of every push/banner/admin alert
  id, reminder_id, kind: 'push'|'banner'|'admin_alert', sent_at, channel

push_subscriptions        -- FCM tokens per user + device
  id, user_id, fcm_token, platform, user_agent, created_at, last_seen_at
```

RLS: installer sees own reminders/subscriptions; admin sees all; service_role full. GRANTs per platform rules.

## Backend

Edge functions:
- `reminders-scan` — cron every 15 min. For each active project past end date, computes `missing`, upserts a `reminders` row at T0, bumps level at T+4h → urgent, T+8h → escalated (creates admin alerts, notifies admins).
- `reminders-notify` — sends FCM push via the messaging integration for each pending notification, writes `reminder_events`.
- `push-subscribe` — stores FCM token from installer's browser.

Cron: `pg_cron` + `pg_net` calling `reminders-scan` every 15 min.

Escalation to admin = insert admin `reminder_events` rows + FCM push to users with `admin` role.

## Frontend

Installer app:
- Service worker `firebase-messaging-sw.js` for background push (kept outside the app-shell PWA guard per pwa skill).
- On first load of `/installer`, prompt for notification permission; store FCM token via `push-subscribe`.
- New **Reminders** inbox tab (bell icon + unread badge) listing open reminders → tap opens the project's Log tab pre-focused on the missing pieces.
- Persistent top banner on Schedule / Projects tabs while any reminder is open; color intensifies with level.
- Inside `InstallerProjectDetail`, show a highlighted "Report needed" strip on delinquent projects.

Admin app:
- New **Escalations** section in the sidebar (badge count) listing escalated reminders with installer, project, hours overdue, and quick "Contact installer" action.

## Files to add
```text
supabase/functions/reminders-scan/index.ts
supabase/functions/reminders-notify/index.ts
supabase/functions/push-subscribe/index.ts
public/firebase-messaging-sw.js
src/hooks/useReminders.ts
src/hooks/usePushRegistration.ts
src/components/installer/reminders/RemindersInbox.tsx
src/components/installer/reminders/ReminderBanner.tsx
src/components/admin/EscalationsView.tsx
src/lib/firebase.ts
```

## Files to change
- `src/pages/InstallerApp.tsx` — add Reminders tab, mount banner, register push.
- `src/components/installer/InstallerProjectDetail.tsx` — surface "Report needed" strip and resolve reminder when logs are added / order completed.
- `src/components/AppSidebar.tsx` — add Escalations entry with badge.
- `src/App.tsx` — route for Escalations.

## Secrets to request
- `FCM_SERVER_KEY` (or Firebase service account JSON) — needed to send push from `reminders-notify`.
- `VITE_FIREBASE_CONFIG` (public) — added to `.env` for the web push client SDK.

## Out of scope
- SMS/email fallback, snooze rules, admin-configurable thresholds, per-project grace overrides — can layer on later.
