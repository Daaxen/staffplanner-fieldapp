-- Rates on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS overtime_rate numeric,
  ADD COLUMN IF NOT EXISTS mileage_rate numeric,
  ADD COLUMN IF NOT EXISTS vat_percent numeric NOT NULL DEFAULT 25;

-- Time entries
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  project_name text,
  client_name text,
  installer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  start_time text,
  end_time text,
  hours numeric NOT NULL DEFAULT 0,
  note text,
  source text NOT NULL DEFAULT 'manual',
  hourly_rate numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "time own read" ON public.time_entries FOR SELECT TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "time own insert" ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "time own update" ON public.time_entries FOR UPDATE TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "time own delete" ON public.time_entries FOR DELETE TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_time_entries_updated BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Expense entries
CREATE TABLE IF NOT EXISTS public.expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  project_name text,
  client_name text,
  installer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  note text,
  receipt_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_entries TO authenticated;
GRANT ALL ON public.expense_entries TO service_role;
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exp own read" ON public.expense_entries FOR SELECT TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "exp own insert" ON public.expense_entries FOR INSERT TO authenticated
  WITH CHECK (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "exp own update" ON public.expense_entries FOR UPDATE TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "exp own delete" ON public.expense_entries FOR DELETE TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_expense_entries_updated BEFORE UPDATE ON public.expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mileage entries
CREATE TABLE IF NOT EXISTS public.mileage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  project_name text,
  client_name text,
  installer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  km numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 25,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mileage_entries TO authenticated;
GRANT ALL ON public.mileage_entries TO service_role;
ALTER TABLE public.mileage_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mil own read" ON public.mileage_entries FOR SELECT TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "mil own insert" ON public.mileage_entries FOR INSERT TO authenticated
  WITH CHECK (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "mil own update" ON public.mileage_entries FOR UPDATE TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "mil own delete" ON public.mileage_entries FOR DELETE TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_mileage_entries_updated BEFORE UPDATE ON public.mileage_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Active timers (one per user)
CREATE TABLE IF NOT EXISTS public.active_timers (
  installer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  project_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.active_timers TO authenticated;
GRANT ALL ON public.active_timers TO service_role;
ALTER TABLE public.active_timers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timer own all" ON public.active_timers FOR ALL TO authenticated
  USING (installer_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (installer_id = auth.uid());