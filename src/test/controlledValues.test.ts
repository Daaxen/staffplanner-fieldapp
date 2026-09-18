import { describe, expect, it } from 'vitest';
import {
  PROJECT_STATUSES,
  STATUS_TRANSITIONS,
  allowedNextStatuses,
  canTransition,
  projectTypeSchema,
  installerTypeSchema,
  absenceTypeSchema,
  transportStopTypeSchema,
  timeSourceSchema,
  employmentTypeSchema,
  projectStatusSchema,
} from '@/lib/validation/controlledValues';

describe('controlled values', () => {
  it('rejects values outside the approved lists', () => {
    expect(projectStatusSchema.safeParse('quoted').success).toBe(false);
    expect(projectTypeSchema.safeParse('repair').success).toBe(false);
    expect(installerTypeSchema.safeParse('freelance').success).toBe(false);
    expect(absenceTypeSchema.safeParse('holiday').success).toBe(false);
    expect(transportStopTypeSchema.safeParse('stop').success).toBe(false);
    expect(timeSourceSchema.safeParse('import').success).toBe(false);
    expect(employmentTypeSchema.safeParse('intern').success).toBe(false);
  });

  it('accepts the approved values', () => {
    expect(projectStatusSchema.safeParse('in-progress').success).toBe(true);
    expect(projectTypeSchema.safeParse('site-survey').success).toBe(true);
    expect(installerTypeSchema.safeParse('sub-vendor').success).toBe(true);
    expect(employmentTypeSchema.safeParse(null).success).toBe(true);
  });

  it('only allows defined status transitions', () => {
    expect(canTransition('open', 'scheduled')).toBe(true);
    expect(canTransition('open', 'completed')).toBe(false);
    expect(canTransition('scheduled', 'completed')).toBe(false);
    expect(canTransition('in-progress', 'completed')).toBe(true);
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('completed', 'completed')).toBe(true);
  });

  it('never points at an unknown status', () => {
    for (const from of PROJECT_STATUSES) {
      for (const to of allowedNextStatuses(from)) {
        expect(PROJECT_STATUSES).toContain(to);
        expect(to).not.toBe(from);
      }
    }
    expect(Object.keys(STATUS_TRANSITIONS).sort()).toEqual([...PROJECT_STATUSES].sort());
  });
});
