/**
 * Actual time on an order = work time + travel time.
 *
 * Work time comes from check-in/check-out (or a manual entry) as
 * start/end times; travel time is reported alongside it. The same two
 * numbers are frozen into job_metrics when the order is completed.
 */

export interface ActualTime {
  /** Hours worked on site. */
  work: number;
  /** Hours travelling to and from the job. */
  travel: number;
  /** Total time on the assignment. */
  total: number;
}

const round1 = (n: number) => Math.round(n * 100) / 100;

export const EMPTY_ACTUAL: ActualTime = { work: 0, travel: 0, total: 0 };

export function sumActualTime(entries: { hours: number; travelHours?: number }[]): ActualTime {
  const work = entries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const travel = entries.reduce((sum, e) => sum + (e.travelHours || 0), 0);
  return { work: round1(work), travel: round1(travel), total: round1(work + travel) };
}

/**
 * Deviation between planned and actual time, in percent.
 * Returns null when there is nothing meaningful to compare.
 */
export function variancePct(planned?: number | null, actual?: number | null): number | null {
  if (!planned || planned <= 0 || actual == null) return null;
  return Math.round(((actual - planned) / planned) * 100);
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function formatVariance(pct: number | null): string {
  if (pct == null) return '—';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

export type VarianceTone = 'over' | 'under' | 'on-target' | 'none';

/** Over 10% above plan is bad, more than 10% below is a positive outcome. */
export function varianceTone(pct: number | null): VarianceTone {
  if (pct == null) return 'none';
  if (pct > 10) return 'over';
  if (pct < -10) return 'under';
  return 'on-target';
}

export const varianceClass: Record<VarianceTone, string> = {
  over: 'text-destructive',
  under: 'text-status-completed',
  'on-target': 'text-foreground',
  none: 'text-muted-foreground',
};
