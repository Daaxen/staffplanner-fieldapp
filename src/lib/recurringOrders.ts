import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Project, ProjectType } from '@/data/mockData';
import { clientRefForRowId } from '@/lib/appData';
import { expandSeries, type RecurrencePause } from '@/lib/recurrence';

/**
 * A standing work order: the rule that generates real, independent work orders.
 * Generated orders are ordinary orders — they are reported, invoiced and
 * rescheduled exactly like any other one, and editing a single occurrence never
 * touches the series.
 */
export interface RecurringSeries {
  id: string;
  name: string;
  /** clients.ref (the app-level customer id). */
  clientRef?: string;
  clientName?: string;
  projectGroupId?: string;
  projectType: ProjectType;
  location?: string;
  street?: string;
  postalCode?: string;
  region?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  startTime?: string;
  endTime?: string;
  estimatedHours?: number;
  description?: string;
  weekdays: number[];
  intervalWeeks: number;
  seriesStart: string;
  seriesEnd: string;
  skipHolidays: boolean;
  pauses: RecurrencePause[];
  active: boolean;
}

export type RecurringSeriesInput = Omit<RecurringSeries, 'id'>;

const COLUMNS =
  'id,name,client_id,project_group_id,project_type,location,street,postal_code,region,' +
  'contact_name,contact_phone,contact_email,start_time,end_time,estimated_hours,description,' +
  'weekdays,interval_weeks,series_start,series_end,skip_holidays,pauses,active';

type Row = Record<string, unknown>;

const trimTime = (v: unknown) => (typeof v === 'string' ? v.slice(0, 5) : undefined);

function fromRow(r: Row): RecurringSeries {
  return {
    id: r.id as string,
    name: (r.name as string) ?? '',
    clientRef: clientRefForRowId(r.client_id as string | null),
    projectGroupId: (r.project_group_id as string | null) ?? undefined,
    projectType: ((r.project_type as string) ?? 'installation') as ProjectType,
    location: (r.location as string | null) ?? undefined,
    street: (r.street as string | null) ?? undefined,
    postalCode: (r.postal_code as string | null) ?? undefined,
    region: (r.region as string | null) ?? undefined,
    contactName: (r.contact_name as string | null) ?? undefined,
    contactPhone: (r.contact_phone as string | null) ?? undefined,
    contactEmail: (r.contact_email as string | null) ?? undefined,
    startTime: trimTime(r.start_time),
    endTime: trimTime(r.end_time),
    estimatedHours: (r.estimated_hours as number | null) ?? undefined,
    description: (r.description as string | null) ?? undefined,
    weekdays: ((r.weekdays as number[] | null) ?? []).slice().sort((a, b) => a - b),
    intervalWeeks: (r.interval_weeks as number) ?? 1,
    seriesStart: r.series_start as string,
    seriesEnd: r.series_end as string,
    skipHolidays: (r.skip_holidays as boolean) ?? true,
    pauses: ((r.pauses as RecurrencePause[] | null) ?? []).filter((p) => p?.from && p?.to),
    active: (r.active as boolean) ?? true,
  };
}

function toRow(s: RecurringSeriesInput, clientRowId?: string) {
  const time = (v?: string) => (v && /^\d{2}:\d{2}/.test(v) ? v : null);
  return {
    name: s.name,
    client_id: clientRowId ?? null,
    project_group_id: s.projectGroupId || null,
    project_type: s.projectType,
    location: s.location || null,
    street: s.street || null,
    postal_code: s.postalCode || null,
    region: s.region || null,
    contact_name: s.contactName || null,
    contact_phone: s.contactPhone || null,
    contact_email: s.contactEmail || null,
    start_time: time(s.startTime),
    end_time: time(s.endTime),
    estimated_hours: s.estimatedHours ?? null,
    description: s.description || null,
    weekdays: s.weekdays,
    interval_weeks: s.intervalWeeks,
    series_start: s.seriesStart,
    series_end: s.seriesEnd,
    skip_holidays: s.skipHolidays,
    pauses: s.pauses,
    active: s.active,
  };
}

export async function fetchRecurringSeries(): Promise<RecurringSeries[]> {
  const { data, error } = await supabase
    .from('recurring_order_series')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function createRecurringSeries(
  input: RecurringSeriesInput,
  clientRowId?: string,
): Promise<RecurringSeries> {
  const { data, error } = await supabase
    .from('recurring_order_series')
    .insert(toRow(input, clientRowId) as never)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function updateRecurringSeries(
  id: string,
  input: RecurringSeriesInput,
  clientRowId?: string,
): Promise<void> {
  const { error } = await supabase
    .from('recurring_order_series')
    .update(toRow(input, clientRowId) as never)
    .eq('id', id);
  if (error) throw error;
}

/** Work orders already generated keep existing; only the link is cleared. */
export async function deleteRecurringSeries(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_order_series').delete().eq('id', id);
  if (error) throw error;
}

const generateOrderRef = () => `P-${Math.floor(Math.random() * 90000) + 10000}`;

/**
 * Builds the work orders for a series. Every occurrence is created unassigned
 * and Open so the planner decides who does it, and dates that already have an
 * order from this series are never duplicated.
 */
export function buildOrdersForSeries(
  series: RecurringSeries,
  existing: Project[],
): Project[] {
  const { dates } = expandSeries(series);
  const taken = new Set(
    existing
      .filter((p) => p.recurrenceSeriesId === series.id)
      .map((p) => p.startDate),
  );

  return dates
    .filter((d) => !taken.has(d))
    .map((date) => ({
      id: generateOrderRef(),
      name: `${series.name} – ${date}`,
      projectType: series.projectType,
      projectGroupId: series.projectGroupId,
      recurrenceSeriesId: series.id,
      clientId: series.clientRef,
      client: series.clientName ?? '',
      location: series.location ?? '',
      street: series.street,
      postalCode: series.postalCode,
      region: series.region,
      status: 'open',
      commercialStatus: 'quote',
      assigneeIds: [],
      startDate: date,
      endDate: date,
      startTime: series.startTime,
      endTime: series.endTime,
      estimatedHours: series.estimatedHours,
      description: series.description,
      contactName: series.contactName,
      contactPhone: series.contactPhone,
      contactEmail: series.contactEmail,
    } as Project));
}

/** Occurrences that can still be regenerated/removed: not staffed, still Open. */
export function untouchedOccurrences(series: RecurringSeries, projects: Project[]): Project[] {
  const today = new Date().toISOString().slice(0, 10);
  return projects.filter(
    (p) =>
      p.recurrenceSeriesId === series.id &&
      p.status === 'open' &&
      (p.assigneeIds ?? []).length === 0 &&
      p.startDate >= today,
  );
}

export function useRecurringSeries() {
  const [series, setSeries] = useState<RecurringSeries[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSeries(await fetchRecurringSeries());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { series, loading, reload };
}
