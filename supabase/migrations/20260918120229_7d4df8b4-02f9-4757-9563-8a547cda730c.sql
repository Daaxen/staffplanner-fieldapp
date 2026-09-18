/* ---------------- time_entries ---------------- */
ALTER TABLE public.time_entries
  ALTER COLUMN start_time TYPE time USING NULLIF(btrim(start_time), '')::time,
  ALTER COLUMN end_time   TYPE time USING NULLIF(btrim(end_time), '')::time;

CREATE OR REPLACE FUNCTION public.validate_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_time <= NEW.start_time THEN
      RAISE EXCEPTION 'End time must be after start time';
    END IF;
    -- calculated hours are authoritative when both times are known
    NEW.hours := round(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2);
  END IF;

  IF NEW.hours IS NULL OR NEW.hours < 0 THEN
    RAISE EXCEPTION 'Hours cannot be negative';
  END IF;
  IF NEW.hours > 16 THEN
    RAISE EXCEPTION 'A single time entry cannot exceed 16 hours';
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_time_entries_validate ON public.time_entries;
CREATE TRIGGER trg_time_entries_validate
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_time_entry();

ALTER TABLE public.time_entries
  ADD CONSTRAINT time_entries_hours_range CHECK (hours >= 0 AND hours <= 16),
  ADD CONSTRAINT time_entries_time_order CHECK (
    start_time IS NULL OR end_time IS NULL OR end_time > start_time
  ),
  ADD CONSTRAINT time_entries_rate_positive CHECK (hourly_rate IS NULL OR hourly_rate >= 0);

/* ---------------- mileage_entries ---------------- */
CREATE OR REPLACE FUNCTION public.validate_mileage_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.km < 0 OR NEW.rate < 0 THEN
    RAISE EXCEPTION 'Kilometres and rate cannot be negative';
  END IF;
  IF NEW.km > 2000 THEN
    RAISE EXCEPTION 'A single mileage entry cannot exceed 2000 km';
  END IF;
  -- the amount is always derived by the database
  NEW.amount := round(NEW.km * NEW.rate, 2);
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_mileage_entries_validate ON public.mileage_entries;
CREATE TRIGGER trg_mileage_entries_validate
  BEFORE INSERT OR UPDATE ON public.mileage_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_mileage_entry();

ALTER TABLE public.mileage_entries
  ADD CONSTRAINT mileage_entries_non_negative CHECK (km >= 0 AND rate >= 0 AND amount >= 0);

/* ---------------- expense rules ---------------- */
CREATE TABLE IF NOT EXISTS public.expense_rules (
  category text PRIMARY KEY,
  requires_receipt boolean NOT NULL DEFAULT true,
  receipt_threshold numeric NOT NULL DEFAULT 0,
  max_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.expense_rules TO authenticated;
GRANT ALL ON public.expense_rules TO service_role;
ALTER TABLE public.expense_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense rules readable" ON public.expense_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "expense rules admin write" ON public.expense_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_expense_rules_updated ON public.expense_rules;
CREATE TRIGGER trg_expense_rules_updated BEFORE UPDATE ON public.expense_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.expense_rules (category, requires_receipt, receipt_threshold, max_amount) VALUES
  ('materials', true,  0,   50000),
  ('travel',    true,  0,   20000),
  ('parking',   true,  100, 5000),
  ('meal',      true,  0,   3000),
  ('other',     true,  0,   20000)
ON CONFLICT (category) DO NOTHING;

/* ---------------- expense_entries ---------------- */
ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS entry_kind text NOT NULL DEFAULT 'expense';

ALTER TABLE public.expense_entries
  ADD CONSTRAINT expense_entries_kind_valid CHECK (entry_kind IN ('expense', 'credit', 'correction')),
  ADD CONSTRAINT expense_entries_category_valid CHECK (
    category IN ('materials', 'travel', 'parking', 'meal', 'other')
  ),
  ADD CONSTRAINT expense_entries_amount_sign CHECK (
    amount >= 0 OR entry_kind IN ('credit', 'correction')
  );

CREATE OR REPLACE FUNCTION public.validate_expense_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_rule public.expense_rules%ROWTYPE;
BEGIN
  SELECT * INTO v_rule FROM public.expense_rules WHERE category = NEW.category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown expense category: %', NEW.category;
  END IF;

  IF NEW.amount < 0 AND NEW.entry_kind NOT IN ('credit', 'correction') THEN
    RAISE EXCEPTION 'A negative amount requires the entry to be a credit or correction';
  END IF;

  IF v_rule.max_amount IS NOT NULL AND abs(NEW.amount) > v_rule.max_amount THEN
    RAISE EXCEPTION 'Amount exceeds the limit for % (% SEK)', NEW.category, v_rule.max_amount;
  END IF;

  IF NEW.entry_kind = 'expense'
     AND v_rule.requires_receipt
     AND NEW.amount > v_rule.receipt_threshold
     AND NULLIF(btrim(COALESCE(NEW.receipt_path, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A receipt is required for % over % SEK', NEW.category, v_rule.receipt_threshold;
  END IF;

  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_expense_entries_validate ON public.expense_entries;
CREATE TRIGGER trg_expense_entries_validate
  BEFORE INSERT OR UPDATE ON public.expense_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense_entry();