DROP POLICY IF EXISTS "votes readable by signed-in users" ON public.feedback_votes;
CREATE POLICY "votes readable by app users" ON public.feedback_votes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

DROP POLICY IF EXISTS "feedback readable by signed-in users" ON public.feedback_items;
CREATE POLICY "feedback readable by app users" ON public.feedback_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

DROP POLICY IF EXISTS "expense rules readable" ON public.expense_rules;
CREATE POLICY "expense rules readable by app users" ON public.expense_rules FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()));