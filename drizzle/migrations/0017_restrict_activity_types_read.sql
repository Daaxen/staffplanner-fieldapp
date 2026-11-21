DROP POLICY IF EXISTS "activity types read" ON public.time_activity_types;
CREATE POLICY "activity types read" ON public.time_activity_types
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));