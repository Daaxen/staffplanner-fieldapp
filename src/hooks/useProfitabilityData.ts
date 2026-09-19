import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { projectRefForRowId, useProjects } from '@/lib/appData';
import { useInstallers } from '@/hooks/useInstallers';
import { emptyInput, type ProfitabilityInput } from '@/lib/profitability';
import type { Project } from '@/data/mockData';

export type ProfitabilityTotals = Record<string, ProfitabilityInput>;

/** Loads logged hours, expenses and mileage per project for the profitability module. */
export function useProfitabilityData() {
  const [projects] = useProjects();
  const { installers } = useInstallers();
  const [inputs, setInputs] = useState<ProfitabilityTotals>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, e, m] = await Promise.all([
      supabase.from('time_entries').select('project_id, installer_id, hours, entry_date'),
      supabase.from('expense_entries').select('project_id, category, amount, entry_date'),
      supabase.from('mileage_entries').select('project_id, km, amount, entry_date'),
    ]);

    // installer_id on reporting rows is public.installers.id
    const isExternal = (installerId: string) =>
      installers.find(i => i.id === installerId)?.type === 'sub-vendor';

    const next: ProfitabilityTotals = {};
    // Reporting rows key on projects.id (uuid); the app keys on the order ref.
    const ensure = (projectRowId: string) => {
      const projectId = projectRefForRowId(projectRowId) ?? projectRowId;
      if (!next[projectId]) {
        const project = projects.find(p => p.id === projectId);
        next[projectId] = emptyInput(project ?? ({ id: projectId, client: '' } as Project));
      }
      return next[projectId];
    };

    (t.data ?? []).forEach(r => {
      const row = ensure(r.project_id);
      const hours = Number(r.hours) || 0;
      if (isExternal(r.installer_id)) row.externalHours += hours;
      else row.internalHours += hours;
    });
    (e.data ?? []).forEach(r => {
      const row = ensure(r.project_id);
      const amount = Number(r.amount) || 0;
      if (r.category === 'materials') row.materialExpenses += amount;
      else if (r.category === 'travel' || r.category === 'parking') row.travelExpenses += amount;
      else row.otherExpenses += amount;
    });
    (m.data ?? []).forEach(r => {
      const row = ensure(r.project_id);
      row.mileageKm += Number(r.km) || 0;
      row.mileageCost += Number(r.amount) || 0;
    });

    setInputs(next);
    setLoading(false);
  }, [installers, projects]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installers.length, projects.length]);

  return { inputs, loading, reload: load };
}
