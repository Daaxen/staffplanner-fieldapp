-- One booking per installer and order: removes duplicates and blocks new ones.
DELETE FROM public.assignments a
USING public.assignments b
WHERE a.project_id = b.project_id
  AND a.installer_id = b.installer_id
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS assignments_project_installer_uidx
  ON public.assignments (project_id, installer_id);

COMMENT ON INDEX public.assignments_project_installer_uidx IS
  'Assignments are the single booking truth: one row per installer and order.';