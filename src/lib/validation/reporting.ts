import { z } from 'zod';

/**
 * Form-level mirror of the database validation rules for operational
 * reporting (time, mileage, expenses). The database is the source of truth —
 * these schemas exist so users get an error before a round trip.
 */

export const MAX_ENTRY_HOURS = 16;
export const MAX_ENTRY_KM = 2000;

export type ExpenseRule = {
  requiresReceipt: boolean;
  receiptThreshold: number;
  maxAmount: number;
};

/** Mirrors public.expense_rules. */
export const EXPENSE_RULES: Record<string, ExpenseRule> = {
  materials: { requiresReceipt: true, receiptThreshold: 0, maxAmount: 50000 },
  travel: { requiresReceipt: true, receiptThreshold: 0, maxAmount: 20000 },
  parking: { requiresReceipt: true, receiptThreshold: 100, maxAmount: 5000 },
  meal: { requiresReceipt: true, receiptThreshold: 0, maxAmount: 3000 },
  other: { requiresReceipt: true, receiptThreshold: 0, maxAmount: 20000 },
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_RULES) as [string, ...string[]];
export const EXPENSE_KINDS = ['expense', 'credit', 'correction'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the HH:MM format');

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Hours calculated from start/end — the database recalculates the same way. */
export function hoursBetween(start: string, end: string): number {
  return Math.round(((toMinutes(end) - toMinutes(start)) / 60) * 100) / 100;
}

export const timeEntrySchema = z
  .object({
    projectId: z.string().min(1, 'Pick an order'),
    date: z.string().min(1, 'Pick a date'),
    startTime: timeOfDay.optional(),
    endTime: timeOfDay.optional(),
    hours: z.number().min(0, 'Hours cannot be negative').max(MAX_ENTRY_HOURS).optional(),
    note: z.string().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    const both = v.startTime && v.endTime;
    if (both && toMinutes(v.endTime!) <= toMinutes(v.startTime!)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time must be after start time',
      });
      return;
    }
    const hours = both ? hoursBetween(v.startTime!, v.endTime!) : (v.hours ?? 0);
    if (hours <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hours'],
        message: 'Enter the hours worked',
      });
    }
    if (hours > MAX_ENTRY_HOURS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hours'],
        message: `A single entry cannot exceed ${MAX_ENTRY_HOURS} hours`,
      });
    }
  });

export const mileageEntrySchema = z.object({
  projectId: z.string().min(1, 'Pick an order'),
  date: z.string().min(1, 'Pick a date'),
  km: z
    .number({ invalid_type_error: 'Enter the distance' })
    .min(0, 'Distance cannot be negative')
    .max(MAX_ENTRY_KM, `A single entry cannot exceed ${MAX_ENTRY_KM} km`),
  rate: z.number().min(0, 'Rate cannot be negative'),
  note: z.string().max(1000).optional(),
});

export const expenseEntrySchema = z
  .object({
    projectId: z.string().min(1, 'Pick an order'),
    date: z.string().min(1, 'Pick a date'),
    category: z.enum(EXPENSE_CATEGORIES, { errorMap: () => ({ message: 'Pick a category' }) }),
    kind: z.enum(EXPENSE_KINDS).default('expense'),
    amount: z.number({ invalid_type_error: 'Enter an amount' }),
    receiptName: z.string().trim().min(1).optional(),
    note: z.string().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    const rule = EXPENSE_RULES[v.category];
    if (!rule) return;
    if (v.amount < 0 && v.kind === 'expense') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'A negative amount must be marked as a credit or correction',
      });
    }
    if (Math.abs(v.amount) > rule.maxAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: `Amount exceeds the limit for this category (${rule.maxAmount} SEK)`,
      });
    }
    if (
      v.kind === 'expense' &&
      rule.requiresReceipt &&
      v.amount > rule.receiptThreshold &&
      !v.receiptName
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['receiptName'],
        message:
          rule.receiptThreshold > 0
            ? `A receipt is required above ${rule.receiptThreshold} SEK`
            : 'A receipt is required for this category',
      });
    }
  });

export type TimeEntryInput = z.infer<typeof timeEntrySchema>;
export type MileageEntryInput = z.infer<typeof mileageEntrySchema>;
export type ExpenseEntryInput = z.infer<typeof expenseEntrySchema>;

/** Returns the first validation message, or null when the input is valid. */
export function firstIssue(result: z.SafeParseReturnType<unknown, unknown>): string | null {
  return result.success ? null : (result.error.issues[0]?.message ?? 'Invalid input');
}
