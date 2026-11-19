/** Travel days around a work order: the day before start and/or the day after end. */
export type TravelFlags = { startDate?: string; endDate?: string; travelBefore?: boolean; travelAfter?: boolean; projectType?: string };

export function shiftIso(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function travelDates(p: TravelFlags): { before?: string; after?: string } {
  if (p.projectType === 'transport') return {};
  return {
    before: p.travelBefore && p.startDate ? shiftIso(p.startDate, -1) : undefined,
    after: p.travelAfter && p.endDate ? shiftIso(p.endDate, 1) : undefined,
  };
}

/** Dates an installer can report on: travel days plus the work days. */
export function reportingRange(p: TravelFlags): { startDate?: string; endDate?: string } {
  const t = travelDates(p);
  return { startDate: t.before ?? p.startDate, endDate: t.after ?? p.endDate };
}
