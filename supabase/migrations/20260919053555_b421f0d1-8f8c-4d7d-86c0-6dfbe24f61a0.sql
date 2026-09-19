-- Orders (planner, dashboards, Customer 360)
CREATE INDEX IF NOT EXISTS projects_client_idx ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects (status);
CREATE INDEX IF NOT EXISTS projects_dates_idx ON public.projects (start_date, end_date);

-- Assignments: (project_id, installer_id) unique index already serves project_id
CREATE INDEX IF NOT EXISTS project_assignees_installer_idx
  ON public.project_assignees (installer_id);

-- Absence lookups for conflict detection
CREATE INDEX IF NOT EXISTS installer_absences_installer_range_idx
  ON public.installer_absences (installer_id, start_date, end_date);

-- Transport stops are always read per order in sort order
CREATE INDEX IF NOT EXISTS transport_stops_project_sort_idx
  ON public.transport_stops (project_id, sort_order);

-- Reporting: composite indexes replace the single-column ones (same leading column)
CREATE INDEX IF NOT EXISTS time_entries_installer_date_idx
  ON public.time_entries (installer_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS time_entries_project_date_idx
  ON public.time_entries (project_id, entry_date);
DROP INDEX IF EXISTS public.time_entries_installer_idx;
DROP INDEX IF EXISTS public.time_entries_project_idx;

CREATE INDEX IF NOT EXISTS expense_entries_installer_date_idx
  ON public.expense_entries (installer_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS expense_entries_project_date_idx
  ON public.expense_entries (project_id, entry_date);
DROP INDEX IF EXISTS public.expense_entries_installer_idx;
DROP INDEX IF EXISTS public.expense_entries_project_idx;

CREATE INDEX IF NOT EXISTS mileage_entries_installer_date_idx
  ON public.mileage_entries (installer_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS mileage_entries_project_date_idx
  ON public.mileage_entries (project_id, entry_date);
DROP INDEX IF EXISTS public.mileage_entries_installer_idx;
DROP INDEX IF EXISTS public.mileage_entries_project_idx;

ANALYZE public.projects;
ANALYZE public.project_assignees;
ANALYZE public.installer_absences;
ANALYZE public.transport_stops;
ANALYZE public.time_entries;
ANALYZE public.expense_entries;
ANALYZE public.mileage_entries;