import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FieldReportState } from '@/lib/operations';

/** Loads the submitted state of field reports, keyed by project ref. */
export function useFieldReportStates() {
  const [reports, setReports] = useState<Record<string, FieldReportState>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('field_reports')
      .select('project_ref,submitted_at,signature,photo_paths,sign_offs');
    if (error) {
      console.error('Failed to load field reports', error);
      setLoading(false);
      return;
    }
    const map: Record<string, FieldReportState> = {};
    for (const row of data ?? []) {
      const ref = row.project_ref as string;
      const photos = Array.isArray(row.photo_paths) ? row.photo_paths.length : 0;
      const signOffs = (row.sign_offs ?? {}) as Record<string, unknown>;
      const hasSignature = !!row.signature || Object.values(signOffs).some(Boolean);
      const prev = map[ref];
      map[ref] = {
        projectRef: ref,
        submittedAt: row.submitted_at ?? prev?.submittedAt ?? null,
        hasSignature: hasSignature || !!prev?.hasSignature,
        photoCount: photos + (prev?.photoCount ?? 0),
      };
    }
    setReports(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { reports, loading, reload: load };
}
