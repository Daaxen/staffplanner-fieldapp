import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { variancePct } from '@/lib/timeVariance';

/**
 * Historical job metrics — one immutable snapshot per completed order.
 *
 * Rows are created automatically by the database when an order's status
 * becomes "completed" (trigger `capture_job_metrics`). They can never be
 * updated or deleted, and only admins may read them.
 *
 * Purpose: historical base for future AI analysis, estimation and
 * planning optimization.
 */
export interface JobMetric {
  id: string;
  /** Human order reference (projects.ref) at completion time. */
  orderId: string | null;
  /** Link to the projects row. */
  projectId: string;
  customer: string | null;
  city: string | null;
  orderType: string | null;
  /** Template/category id, when the order used one. */
  category: string | null;
  installerIds: string[];
  plannedHours: number | null;
  actualHours: number;
  /** Travel time reported on the order, summed from the time entries. */
  travelHours: number;
  /** Work time + travel time. */
  totalHours: number;
  /** Deviation between planned and total actual time, in percent. */
  variancePct: number | null;
  plannedInstallers: number;
  actualInstallers: number;
  plannedDate: string | null;
  completedDate: string;
  materialCost: number;
  jobValue: number | null;
  createdAt: string;
}

type Row = {
  id: string;
  order_id: string | null;
  project_id: string;
  customer: string | null;
  city: string | null;
  order_type: string | null;
  category: string | null;
  installer_ids: string[];
  planned_hours: number | null;
  actual_hours: number;
  travel_hours: number;
  planned_installers: number;
  actual_installers: number;
  planned_date: string | null;
  completed_date: string;
  material_cost: number;
  job_value: number | null;
  created_at: string;
};

function mapRow(r: Row): JobMetric {
  return {
    id: r.id,
    orderId: r.order_id,
    projectId: r.project_id,
    customer: r.customer,
    city: r.city,
    orderType: r.order_type,
    category: r.category,
    installerIds: r.installer_ids ?? [],
    plannedHours: r.planned_hours,
    actualHours: r.actual_hours,
    travelHours: r.travel_hours,
    plannedInstallers: r.planned_installers,
    actualInstallers: r.actual_installers,
    plannedDate: r.planned_date,
    completedDate: r.completed_date,
    materialCost: r.material_cost,
    jobValue: r.job_value,
    createdAt: r.created_at,
    totalHours: Math.round((Number(r.actual_hours ?? 0) + Number(r.travel_hours ?? 0)) * 100) / 100,
    variancePct: variancePct(r.planned_hours, Number(r.actual_hours ?? 0) + Number(r.travel_hours ?? 0)),
  };
}

/** All historical metrics, newest first. Admin-only (enforced by RLS). */
export async function listJobMetrics(): Promise<JobMetric[]> {
  const { data, error } = await supabase
    .from('job_metrics' as never)
    .select('*')
    .order('completed_date', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

/** Metrics for a single order (at most one row exists). */
export async function getJobMetricForProject(projectId: string): Promise<JobMetric | null> {
  const { data, error } = await supabase
    .from('job_metrics' as never)
    .select('*')
    .eq('project_id' as never, projectId as never)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRow(data as unknown as Row) : null;
}

/** Metrics for one customer, for per-customer analysis. */
export async function listJobMetricsForCustomer(customer: string): Promise<JobMetric[]> {
  const { data, error } = await supabase
    .from('job_metrics' as never)
    .select('*')
    .eq('customer' as never, customer as never)
    .order('completed_date', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

/** React hook: all historical metrics (admin-only data). */
export function useJobMetrics(): { metrics: JobMetric[]; loading: boolean } {
  const [metrics, setMetrics] = useState<JobMetric[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    listJobMetrics()
      .then((rows) => {
        if (alive) setMetrics(rows);
      })
      .catch((e) => console.error('Failed to load job metrics', e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { metrics, loading };
}
