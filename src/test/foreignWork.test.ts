import { describe, it, expect } from 'vitest';
import { countDays, evaluateRule, statusFor, ruleWindow, projectBooking, docStatus, datesInRange, longestContinuous, type ForeignDay, type ForeignRule } from '@/lib/foreignWork';

const day = (d: string, o: Partial<ForeignDay> = {}): ForeignDay => ({ installer_id: 'i1', country: 'FI', day: d, is_work: true, is_presence: true, work_source: 'time_entry', presence_source: 'work_day', verification: 'DERIVED', project_ids: [], conflict: false, ...o });
const presence = (d: string, o: Partial<ForeignDay> = {}) => day(d, { is_work: false, presence_source: 'presence_period', ...o });
const rule = (o: Partial<ForeignRule> = {}): ForeignRule => ({ id: 'r', name: 'R', countries: [], metric: 'PRESENCE_DAYS', window_type: 'CALENDAR_YEAR', window_start: null, window_end: null, watch_threshold: 10, review_threshold: 20, critical_threshold: 30, effective_from: '2020-01-01', effective_to: null, enabled: true, explanation: null, ...o });
const range = (a: string, b: string, f = day) => datesInRange(a, b).map(d => f(d));

describe('calculation', () => {
  it('CALC-01 one work day counts once', () => expect(countDays([day('2026-03-02'), day('2026-03-02')]).work).toBe(1));
  it('CALC-02 multi-day assignment', () => expect(countDays(range('2026-03-02', '2026-03-06')).work).toBe(5));
  it('CALC-03/04 travel Sunday + weekend presence not work', () => {
    const c = countDays([presence('2026-03-01'), ...range('2026-03-02', '2026-03-06')]);
    expect(c).toMatchObject({ work: 5, presence: 6 });
  });
  it('CALC-05/06 cross month and year', () => {
    expect(countDays(range('2026-01-30', '2026-02-02')).presence).toBe(4);
    expect(countDays(range('2026-12-30', '2027-01-02')).presence).toBe(4);
  });
  it('CALC-07 leap year', () => expect(countDays(range('2028-02-28', '2028-03-01')).presence).toBe(3));
  it('CALC-08/09 trips aggregate per country, countries separate', () => {
    const days = [...range('2026-03-02', '2026-03-03'), ...range('2026-05-04', '2026-05-05'), day('2026-03-04', { country: 'NO' })];
    expect(evaluateRule(rule({ watch_threshold: 1 }), 'FI', days, '2026-06-01')!.value).toBe(4);
    expect(evaluateRule(rule({ watch_threshold: 1 }), 'NO', days, '2026-06-01')!.value).toBe(1);
  });
  it('CALC-10 booking + time entries do not double count', () => {
    const p = projectBooking(rule(), 'FI', range('2026-03-02', '2026-03-04'), '2026-03-05', { installer_id: 'i1', start: '2026-03-02', end: '2026-03-06' })!;
    expect(p.projected).toBe(5);
  });
  it('CALC-11 overlapping sources merged deterministically', () => expect(countDays([presence('2026-03-02'), day('2026-03-02')])).toMatchObject({ work: 1, presence: 1 }));
  it('CALC-14 date strings do not drift', () => expect(datesInRange('2026-03-28', '2026-03-30')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']));
  it('CALC-15 domestic absent from facts', () => expect(evaluateRule(rule(), 'SE', range('2026-03-02', '2026-03-06'), '2026-04-01')!.value).toBe(0));
});

describe('rules', () => {
  const r = rule();
  it('RULE-01..04 thresholds', () => {
    expect(statusFor(9, r)).toBe('NORMAL');
    expect(statusFor(10, r)).toBe('WATCH');
    expect(statusFor(20, r)).toBe('REVIEW');
    expect(statusFor(30, r)).toBe('REACHED');
  });
  it('RULE-05 disabled', () => expect(evaluateRule(rule({ enabled: false }), 'FI', [], '2026-01-01')).toBeNull());
  it('RULE-06 future', () => expect(evaluateRule(rule({ effective_from: '2027-01-01' }), 'FI', [], '2026-06-01')).toBeNull());
  it('RULE-07 expired', () => expect(evaluateRule(rule({ effective_to: '2025-12-31' }), 'FI', [], '2026-06-01')).toBeNull());
  it('RULE-08 country-specific', () => expect(evaluateRule(rule({ countries: ['NO'] }), 'FI', [], '2026-06-01')).toBeNull());
  it('RULE-09 rolling window drops old days', () => {
    const w = ruleWindow(rule({ window_type: 'ROLLING_12_MONTHS' }), '2026-06-15')!;
    expect(w).toEqual({ from: '2025-06-16', to: '2026-06-15' });
    expect(evaluateRule(rule({ window_type: 'ROLLING_12_MONTHS' }), 'FI', [day('2025-06-15'), day('2025-06-16')], '2026-06-15')!.value).toBe(1);
  });
  it('RULE-10 calendar year separate from rolling', () => {
    const days = [day('2025-12-01'), day('2026-01-05')];
    expect(evaluateRule(rule(), 'FI', days, '2026-02-01')!.value).toBe(1);
    expect(evaluateRule(rule({ window_type: 'ROLLING_12_MONTHS' }), 'FI', days, '2026-02-01')!.value).toBe(2);
  });
  it('RULE-11 continuous not cumulative', () => {
    expect(longestContinuous([...range('2026-03-02', '2026-03-04'), ...range('2026-03-10', '2026-03-11')])).toBe(3);
  });
  it('RULE-12 missing home / window -> NOT_VERIFIED', () => {
    expect(evaluateRule(rule(), 'FI', [], '2026-06-01', false)!.status).toBe('NOT_VERIFIED');
    expect(evaluateRule(rule({ window_type: 'FIXED_DATE_RANGE' }), 'FI', [], '2026-06-01')!.status).toBe('NOT_VERIFIED');
  });
});

describe('scheduling', () => {
  it('SCHED-02/03 projection reaching review', () => {
    const p = projectBooking(rule(), 'FI', range('2026-03-01', '2026-03-15'), '2026-04-01', { installer_id: 'i1', start: '2026-04-01', end: '2026-04-05' })!;
    expect(p).toMatchObject({ added: 5, projected: 20, status: 'REVIEW' });
  });
  it('SCHED-06 missing dates -> NOT_VERIFIED', () => expect(projectBooking(rule(), 'FI', [], '2026-04-01', { installer_id: 'i1' })!.status).toBe('NOT_VERIFIED'));
});

describe('documents', () => {
  it('DOC-01..04', () => {
    expect(docStatus({ status: 'VALID', valid_from: '2026-01-01', valid_to: '2026-12-31' }, '2026-06-01')).toBe('VALID');
    expect(docStatus({ status: 'VALID', valid_from: '2026-01-01', valid_to: '2026-06-20' }, '2026-06-01')).toBe('EXPIRING');
    expect(docStatus({ status: 'VALID', valid_from: '2026-01-01', valid_to: '2026-05-01' }, '2026-06-01')).toBe('EXPIRED');
    expect(docStatus(null, '2026-06-01')).toBe('MISSING');
    expect(docStatus({ status: 'VALID', valid_from: null, valid_to: null }, '2026-06-01')).toBe('NOT_VERIFIED');
  });
});
