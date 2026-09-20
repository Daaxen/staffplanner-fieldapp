import { isSwedishHoliday } from '@/utils/swedishHolidays';

/**
 * Pure date expansion for standing (recurring) work orders.
 *
 * A series describes which weekdays repeat, how often, between which dates,
 * and which periods are paused (holidays, Christmas shutdown, …).
 * No database access here so the rules stay testable on their own.
 */

export interface RecurrencePause {
  from: string; // ISO date, inclusive
  to: string;   // ISO date, inclusive
}

export interface RecurrenceRule {
  /** ISO weekday numbers: 1 = Monday … 7 = Sunday. */
  weekdays: number[];
  /** 1 = every week, 2 = every other week, … */
  intervalWeeks: number;
  /** ISO date, inclusive. */
  seriesStart: string;
  /** ISO date, inclusive. */
  seriesEnd: string;
  skipHolidays: boolean;
  pauses: RecurrencePause[];
}

export interface RecurrenceExpansion {
  /** Dates that will become work orders, ascending. */
  dates: string[];
  /** Dates that matched the weekday rule but were skipped. */
  skipped: { date: string; reason: 'holiday' | 'pause' }[];
}

const DAY_MS = 86400000;

function parseISO(d: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const [y, m, day] = d.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 1 = Monday … 7 = Sunday, matching the weekday numbers stored on a series. */
export function isoWeekday(date: Date): number {
  return date.getUTCDay() === 0 ? 7 : date.getUTCDay();
}

/** Monday of the week the date falls in. */
function mondayOf(date: Date): Date {
  return new Date(date.getTime() - (isoWeekday(date) - 1) * DAY_MS);
}

function inPause(date: string, pauses: RecurrencePause[]): boolean {
  return pauses.some((p) => p.from && p.to && date >= p.from && date <= p.to);
}

/** Hard ceiling so a typo in the end date can never generate thousands of orders. */
export const MAX_OCCURRENCES = 400;

export function expandSeries(rule: RecurrenceRule): RecurrenceExpansion {
  const empty: RecurrenceExpansion = { dates: [], skipped: [] };
  const start = parseISO(rule.seriesStart);
  const end = parseISO(rule.seriesEnd);
  if (!start || !end || end < start) return empty;

  const weekdays = new Set(rule.weekdays.filter((d) => d >= 1 && d <= 7));
  if (weekdays.size === 0) return empty;

  const interval = Math.max(1, Math.floor(rule.intervalWeeks || 1));
  const anchor = mondayOf(start);
  const pauses = rule.pauses ?? [];

  const dates: string[] = [];
  const skipped: RecurrenceExpansion['skipped'] = [];

  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    if (!weekdays.has(isoWeekday(cursor))) continue;

    const weeksSinceAnchor = Math.round((mondayOf(cursor).getTime() - anchor.getTime()) / (7 * DAY_MS));
    if (weeksSinceAnchor % interval !== 0) continue;

    const iso = toISO(cursor);
    if (inPause(iso, pauses)) {
      skipped.push({ date: iso, reason: 'pause' });
      continue;
    }
    if (rule.skipHolidays && isSwedishHoliday(iso)) {
      skipped.push({ date: iso, reason: 'holiday' });
      continue;
    }
    dates.push(iso);
    if (dates.length >= MAX_OCCURRENCES) break;
  }

  return { dates, skipped };
}

export const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
];
