import { isWeekendIso } from '@/lib/ganttDates';

/**
 * Planning occupancy: 100% = every weekday (Mon–Fri, 8 h) booked, minus absence weekdays.
 * Unbooked weekdays lower the %, booked weekend days push it above 100%.
 */
export function occupancyPct(
  days: string[],
  bookings: { startDate: string; endDate: string; worksWeekends?: boolean }[],
  absences: { startDate: string; endDate: string }[],
): number {
  let target = 0, booked = 0;
  for (const d of days) {
    const weekend = isWeekendIso(d);
    const absent = absences.some(a => d >= a.startDate && d <= a.endDate);
    if (!weekend && !absent) target++;
    if (bookings.some(b => d >= b.startDate && d <= b.endDate && (!weekend || b.worksWeekends)) && !(absent && !weekend)) booked++;
  }
  if (target === 0) return booked > 0 ? 100 : 0;
  return Math.round((booked / target) * 100);
}
