import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TRClient, TRGroup, TROrder, TimeRow } from '@/lib/timeReporting';

export type ActivityType = { id: string; name: string };
export type Employee = { id: string; name: string };

/** Reference lists used by every time-reporting screen. RLS decides what each user sees. */
export function useTimeReportingRefs() {
  const [clients, setClients] = useState<TRClient[]>([]);
  const [groups, setGroups] = useState<TRGroup[]>([]);
  const [orders, setOrders] = useState<TROrder[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    (async () => {
      const [c, g, o, a, e] = await Promise.all([
        supabase.rpc('time_report_clients'),
        supabase.from('project_groups').select('id,name,project_number,client_id').order('name'),
        supabase.from('projects').select('id,name,project_number,client_id,project_group_id').eq('sandbox', false).neq('status', 'cancelled').order('name'),
        supabase.from('time_activity_types').select('id,name').eq('active', true).order('sort_order'),
        supabase.from('installers').select('id,name').order('name'),
      ]);
      setClients((c.data ?? []) as TRClient[]);
      setGroups((g.data ?? []) as TRGroup[]);
      setOrders((o.data ?? []) as TROrder[]);
      setActivities((a.data ?? []) as ActivityType[]);
      setEmployees((e.data ?? []) as Employee[]);
    })();
  }, []);
  return { clients, groups, orders, activities, employees };
}

const COLS = 'id,installer_id,entry_date,client_id,project_group_id,project_id,activity_type_id,hours,travel_hours,description,note,created_at,updated_at';

export function useTimeRows(filter: { from: string; to: string; installerId?: string | null }) {
  const [rows, setRows] = useState<TimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('time_entries').select(COLS).gte('entry_date', filter.from).lte('entry_date', filter.to).order('entry_date').order('created_at');
    if (filter.installerId) q = q.eq('installer_id', filter.installerId);
    const { data } = await q;
    setRows((data ?? []) as unknown as TimeRow[]);
    setLoading(false);
  }, [filter.from, filter.to, filter.installerId]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, reload };
}
