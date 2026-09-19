DROP TRIGGER IF EXISTS trg_audit_document_access ON public.document_access;
CREATE TRIGGER trg_audit_document_access
  AFTER INSERT OR UPDATE OR DELETE ON public.document_access
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('document_access', '', 'profile_id', 'reason');