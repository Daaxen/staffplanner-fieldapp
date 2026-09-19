import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { projectRefForRowId } from '@/lib/appData';

export type ProjectReceipt = {
  id: string;
  projectId: string;
  date: string;
  category: string;
  amount: number;
  note?: string;
  path: string;
};

/**
 * Receipts attached to expense entries, grouped by order ref.
 * Reads the existing expense_entries table — RLS decides what is visible.
 */
export function useProjectReceipts() {
  const [receipts, setReceipts] = useState<Record<string, ProjectReceipt[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expense_entries')
      .select('id, project_id, entry_date, category, amount, note, receipt_path')
      .not('receipt_path', 'is', null)
      .order('entry_date', { ascending: false });

    const next: Record<string, ProjectReceipt[]> = {};
    (data ?? []).forEach(r => {
      const projectId = projectRefForRowId(r.project_id) ?? r.project_id;
      const entry: ProjectReceipt = {
        id: r.id,
        projectId,
        date: r.entry_date,
        category: r.category,
        amount: Number(r.amount) || 0,
        note: r.note ?? undefined,
        path: r.receipt_path as string,
      };
      (next[projectId] ??= []).push(entry);
    });
    setReceipts(next);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { receipts, loading, reload: load };
}
