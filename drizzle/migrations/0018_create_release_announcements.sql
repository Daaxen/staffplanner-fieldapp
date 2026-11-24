CREATE TABLE public.release_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  release_date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  summary text NOT NULL,
  meaning text NOT NULL,
  how_it_works text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  target_roles public.app_role[] NOT NULL DEFAULT '{}'::public.app_role[],
  is_active boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT release_announcements_severity_check CHECK (severity IN ('info', 'important', 'action_required')),
  CONSTRAINT release_announcements_title_check CHECK (char_length(btrim(title)) >= 3),
  CONSTRAINT release_announcements_summary_check CHECK (char_length(btrim(summary)) >= 3),
  CONSTRAINT release_announcements_meaning_check CHECK (char_length(btrim(meaning)) >= 3),
  CONSTRAINT release_announcements_how_check CHECK (char_length(btrim(how_it_works)) >= 3),
  CONSTRAINT release_announcements_version_check CHECK (char_length(btrim(version)) >= 1)
);
GRANT SELECT, INSERT, UPDATE ON public.release_announcements TO authenticated;
GRANT ALL ON public.release_announcements TO service_role;
ALTER TABLE public.release_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read all release announcements"
ON public.release_announcements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "staff read active targeted release announcements"
ON public.release_announcements FOR SELECT TO authenticated
USING (
  is_active
  AND published_at IS NOT NULL
  AND published_at <= now()
  AND (ends_at IS NULL OR ends_at > now())
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'installer')
    OR public.has_role(auth.uid(), 'hr')
    OR public.has_role(auth.uid(), 'superuser')
  )
  AND (
    cardinality(target_roles) = 0
    OR EXISTS (
      SELECT 1 FROM unnest(target_roles) AS target_role
      WHERE public.has_role(auth.uid(), target_role)
    )
  )
);
CREATE POLICY "admins create release announcements"
ON public.release_announcements FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update release announcements"
ON public.release_announcements FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.release_announcement_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.release_announcements(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT release_announcement_acknowledgements_unique UNIQUE (announcement_id, user_id)
);
GRANT SELECT, INSERT ON public.release_announcement_acknowledgements TO authenticated;
GRANT ALL ON public.release_announcement_acknowledgements TO service_role;
ALTER TABLE public.release_announcement_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own or admins read all release acknowledgements"
ON public.release_announcement_acknowledgements FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users acknowledge visible release announcements"
ON public.release_announcement_acknowledgements FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.release_announcements AS announcement
    WHERE announcement.id = announcement_id
  )
);

CREATE TRIGGER update_release_announcements_updated_at
BEFORE UPDATE ON public.release_announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_audit_release_announcements
AFTER INSERT OR UPDATE ON public.release_announcements
FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(
  'release_announcement', 'title', 'version', 'title', 'summary', 'meaning',
  'how_it_works', 'severity', 'target_roles', 'is_active', 'release_date',
  'published_at', 'ends_at'
);

CREATE INDEX release_announcements_active_published_idx
ON public.release_announcements (is_active, published_at DESC);
CREATE INDEX release_announcement_ack_user_idx
ON public.release_announcement_acknowledgements (user_id, acknowledged_at DESC);