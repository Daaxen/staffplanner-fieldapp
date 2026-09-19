import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AbsenceRow {
  id: string;
  installerId: string;
  type: string;
  startDate: string;
  endDate: string;
  label: string | null;
}

export interface OverrideRow {
  id: string;
  installerId: string | null;
  projectId: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  reason: string;
  conflicts: unknown;
  createdAt: string;
}

/** Planned absences and admin booking overrides used by resource planning. */
export function useResourceData() {
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: abs }, { data: ovr }] = await Promise.all([
      supabase.from('installer_absences').select('id,installer_id,type,start_date,end_date,label'),
      supabase
        .from('assignment_overrides')
        .select('id,installer_id,project_id,planned_start_at,planned_end_at,reason,conflicts,created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    setAbsences(
      (abs ?? []).map(a => ({
        id: a.id,
        installerId: a.installer_id,
        type: a.type,
        startDate: a.start_date,
        endDate: a.end_date,
        label: a.label,
      })),
    );
    setOverrides(
      (ovr ?? []).map(o => ({
        id: o.id,
        installerId: o.installer_id,
        projectId: o.project_id,
        plannedStartAt: o.planned_start_at,
        plannedEndAt: o.planned_end_at,
        reason: o.reason,
        conflicts: o.conflicts,
        createdAt: o.created_at,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { absences, overrides, loading, reload };
}
