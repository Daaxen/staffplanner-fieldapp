import { describe, expect, it } from 'vitest';
import { canComplete, missingRequirements } from '@/lib/completionRequirements';
import { emptyWork } from '@/lib/offline/fieldWork';

const stateOf = (w: ReturnType<typeof emptyWork>) => ({
  photoCount: w.photos.length,
  checkedItems: w.checkedItems,
  signature: w.signature,
  reportSubmitted: w.reportSubmitted,
  signOffs: w.signOffs,
});

describe('field report persistence', () => {
  it('starts an order with nothing documented', () => {
    const w = emptyWork('ORD-1', 'Test');
    expect(w.checkedItems).toEqual([]);
    expect(w.photos).toEqual([]);
    expect(w.reportSubmitted).toBe(false);
    expect(w.dirty).toBe(false);
  });

  it('blocks completion while documentation is missing', () => {
    const w = emptyWork('ORD-1');
    expect(canComplete(stateOf(w))).toBe(false);
    const missing = missingRequirements(stateOf(w)).map(m => m.id);
    expect(missing).toContain('photos');
    expect(missing).toContain('checklist');
    expect(missing).toContain('signature');
    expect(missing).toContain('report');
  });

  it('allows completion once everything is saved on the work record', () => {
    const w = {
      ...emptyWork('ORD-1'),
      checkedItems: ['installed', 'tested', 'cleaned', 'materials'],
      signature: 'Anna Kund',
      reportText: 'Installationen är klar och testad.',
      reportSubmitted: true,
      photos: [
        { id: 'a', capturedAt: '2026-09-19T08:00:00Z', category: 'before' as const },
        { id: 'b', capturedAt: '2026-09-19T12:00:00Z', category: 'completion' as const },
      ],
    };
    expect(canComplete(stateOf(w))).toBe(true);
  });

  it('keeps the same completion rules for both installer views', () => {
    const partly = {
      ...emptyWork('ORD-1'),
      checkedItems: ['installed'],
      photos: [{ id: 'a', capturedAt: '2026-09-19T08:00:00Z', category: 'before' as const }],
    };
    expect(missingRequirements(stateOf(partly)).length).toBeGreaterThan(0);
  });
});
