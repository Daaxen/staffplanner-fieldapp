CREATE TABLE public.feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL DEFAULT 'bug',
  priority text NOT NULL DEFAULT 'medium',
  description text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name text,
  reporter_role text,
  page_path text,
  order_number text,
  project_number text,
  device text,
  browser text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_items_type_chk CHECK (type IN ('bug','improvement','feature','mobile','other')),
  CONSTRAINT feedback_items_priority_chk CHECK (priority IN ('low','medium','high','critical')),
  CONSTRAINT feedback_items_status_chk CHECK (status IN ('new','investigating','planned','resolved','rejected')),
  CONSTRAINT feedback_items_title_chk CHECK (char_length(btrim(title)) >= 3)
);

CREATE INDEX feedback_items_status_idx ON public.feedback_items (status, created_at DESC);
CREATE INDEX feedback_items_type_idx ON public.feedback_items (type, created_at DESC);
CREATE INDEX feedback_items_created_by_idx ON public.feedback_items (created_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_items TO authenticated;
GRANT ALL ON public.feedback_items TO service_role;

ALTER TABLE public.feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback readable by signed-in users"
  ON public.feedback_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "users create own feedback"
  ON public.feedback_items FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "users edit own untouched feedback"
  ON public.feedback_items FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND status = 'new')
  WITH CHECK (created_by = auth.uid() AND status = 'new');

CREATE POLICY "admins manage feedback"
  ON public.feedback_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete feedback"
  ON public.feedback_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_feedback_items_updated_at
  BEFORE UPDATE ON public.feedback_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.feedback_votes (
  feedback_id uuid NOT NULL REFERENCES public.feedback_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, user_id)
);

CREATE INDEX feedback_votes_user_idx ON public.feedback_votes (user_id);

GRANT SELECT, INSERT, DELETE ON public.feedback_votes TO authenticated;
GRANT ALL ON public.feedback_votes TO service_role;

ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes readable by signed-in users"
  ON public.feedback_votes FOR SELECT TO authenticated USING (true);

CREATE POLICY "users cast own vote"
  ON public.feedback_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users remove own vote"
  ON public.feedback_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());