import { describe, it, expect } from 'vitest';
import { travelDates, reportingRange } from '@/lib/travelDays';

describe('resdagar', () => {
  it('resdag dit = söndagen före en måndagsstart', () =>
    expect(travelDates({ startDate: '2026-11-16', endDate: '2026-11-18', travelBefore: true }).before).toBe('2026-11-15'));
  it('resdag hem = dagen efter sista arbetsdag', () =>
    expect(travelDates({ startDate: '2026-11-16', endDate: '2026-11-18', travelAfter: true }).after).toBe('2026-11-19'));
  it('montören kan rapportera på resdagarna', () =>
    expect(reportingRange({ startDate: '2026-11-16', endDate: '2026-11-18', travelBefore: true, travelAfter: true })).toEqual({ startDate: '2026-11-15', endDate: '2026-11-19' }));
  it('utan resdagar ändras inget', () =>
    expect(reportingRange({ startDate: '2026-11-16', endDate: '2026-11-18' })).toEqual({ startDate: '2026-11-16', endDate: '2026-11-18' }));
});

import { travelDates as td2 } from '@/lib/travelDays';
import { it as it2, expect as ex2 } from 'vitest';
it2('transport orders never get travel days', () => {
  ex2(td2({ projectType: 'transport', startDate: '2026-11-23', endDate: '2026-11-24', travelBefore: true, travelAfter: true })).toEqual({});
});
