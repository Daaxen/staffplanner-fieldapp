DROP INDEX IF EXISTS public.clients_ref_key;
DROP INDEX IF EXISTS public.projects_ref_key;
CREATE UNIQUE INDEX clients_ref_key ON public.clients (ref);
CREATE UNIQUE INDEX projects_ref_key ON public.projects (ref);