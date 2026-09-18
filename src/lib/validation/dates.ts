import { z } from 'zod';

/**
 * Date integrity rules. Mirrors the database constraints
 * projects_date_range and installer_absences_date_range.
 */

export const DATE_RANGE_MESSAGE_SV =
  'Slutdatum måste vara samma dag som eller efter startdatum.';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ogiltigt datumformat (ÅÅÅÅ-MM-DD).');

/** Orders may be open ended: either date, or both, may be missing. */
export const projectDatesSchema = z
  .object({
    startDate: isoDate.optional().nullable(),
    endDate: isoDate.optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.startDate && v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: DATE_RANGE_MESSAGE_SV });
    }
  });

/** Absences always need both dates. */
export const absenceDatesSchema = z
  .object({ startDate: isoDate, endDate: isoDate })
  .superRefine((v, ctx) => {
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: DATE_RANGE_MESSAGE_SV });
    }
  });

/** Returns a Swedish error message, or null when the range is valid. */
export function projectDateRangeError(
  startDate?: string | null,
  endDate?: string | null,
): string | null {
  const r = projectDatesSchema.safeParse({ startDate, endDate });
  return r.success ? null : (r.error.issues[0]?.message ?? DATE_RANGE_MESSAGE_SV);
}

export function absenceDateRangeError(startDate: string, endDate: string): string | null {
  const r = absenceDatesSchema.safeParse({ startDate, endDate });
  return r.success ? null : (r.error.issues[0]?.message ?? DATE_RANGE_MESSAGE_SV);
}
