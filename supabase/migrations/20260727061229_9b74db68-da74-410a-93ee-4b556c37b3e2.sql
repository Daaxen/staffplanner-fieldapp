
-- Enums
CREATE TYPE public.reminder_level AS ENUM ('gentle', 'urgent', 'escalated');
CREATE TYPE public.reminder_status AS ENUM ('open', 'resolved', 'dismissed');
CREATE TYPE public.reminder_event_kind AS ENUM ('push', 'banner', 'admin_alert');

-- reminders
CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  installer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL,
  level public.reminder_level NOT NULL DEFAULT 'gentle',
  status public.reminder_status NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  last_notified_at timestamptz,
  missing jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, installer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Installers view own reminders"
  ON public.reminders FOR SELECT TO authenticated
  USING (installer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Installers update own reminders"
  ON public.reminders FOR UPDATE TO authenticated
  USING (installer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage reminders"
  ON public.reminders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- reminder_events
CREATE TABLE public.reminder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  kind public.reminder_event_kind NOT NULL,
  channel text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.reminder_events TO authenticated;
GRANT ALL ON public.reminder_events TO service_role;
ALTER TABLE public.reminder_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View events for own reminders"
  ON public.reminder_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.reminders r WHERE r.id = reminder_id AND r.installer_id = auth.uid())
  );

-- push_subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  platform text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fcm_token)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_reminders_installer ON public.reminders(installer_id, status);
CREATE INDEX idx_reminders_project ON public.reminders(project_id);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);
