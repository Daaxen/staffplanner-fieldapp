import { describe, expect, it } from 'vitest';
import { checklistFor, isReportingDone, signOffsFor } from '@/lib/completionRequirements';
import { computeHours } from '@/data/logsData';

const base = { photoCount: 0, checkedItems: [] as string[], signature: '', reportSubmitted: false, signOffs: {} };

describe('installer reporting done', () => {
  it('is not done before the written report is submitted', () => {
    expect(isReportingDone({ ...base }, undefined)).toBe(false);
  });
  it('is done once the report is submitted, without photos or customer signature', () => {
    const checkedItems = checklistFor(undefined).map(c => c.id);
    const signOffs = Object.fromEntries(signOffsFor(undefined).filter(so => so.by !== 'customer').map(so => [so.id, 'Test Montör']));
    expect(isReportingDone({ ...base, checkedItems, signOffs, reportSubmitted: true }, undefined)).toBe(true);
    expect(isReportingDone({ ...base, checkedItems, signOffs, reportSubmitted: false }, undefined)).toBe(false);
  });
});

describe('time correction duration', () => {
  it('derives hours from corrected start and end', () => {
    expect(computeHours('07:30', '16:00')).toBe(8.5);
  });
  it('rejects an end before the start', () => {
    expect(computeHours('16:00', '07:30')).toBe(0);
  });
});
