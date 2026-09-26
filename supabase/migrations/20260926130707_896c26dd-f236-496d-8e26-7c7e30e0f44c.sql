CREATE OR REPLACE FUNCTION public.time_report_clients()
RETURNS TABLE(id uuid, name text, customer_number text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.customer_number FROM clients c
  WHERE auth.uid() IS NOT NULL AND c.sandbox = false
  ORDER BY (c.customer_number = '9999') DESC, c.name
$$;
REVOKE EXECUTE ON FUNCTION public.time_report_clients() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.time_report_clients() TO authenticated;