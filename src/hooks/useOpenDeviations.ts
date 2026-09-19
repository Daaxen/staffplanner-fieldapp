import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { projectRefForRowId } from '@/lib/appData';

/** Number of unresolved deviations per order, keyed by order ref. */
export function useOpenDeviations() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('deviations')
      .select('project_id, project_ref, status')
      .neq('status', 'resolved');
    if (error) {
      console.error('Failed to load deviations', error);
      setLoading(false);
      return;
    }
    const map: Record<string, number> = {};
    for (const row of data ?? []) {
      const ref = projectRefForRowId(row.project_id as string) ?? (row.project_ref as string);
      map[ref] = (map[ref] ?? 0) + 1;
    }
    setCounts(map);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { counts, loading, reload: load };
}
