import { describe, expect, it } from 'vitest';
import {
  canComplete,
  missingRecommendations,
  missingRequirements,
  PHOTOS_SKIPPED_KEY,
} from '@/lib/completionRequirements';
import { PROJECT_TEMPLATES } from '@/lib/projectTemplates';
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
    expect(missing).not.toContain('photos');
    expect(missing).toContain('checklist');
    expect(missing).not.toContain('signature');
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

  const allButPhotos = () => ({
    ...emptyWork('ORD-2'),
    checkedItems: ['installed', 'tested', 'cleaned', 'materials'],
    signature: 'Anna Kund',
    reportSubmitted: true,
  });

  it('allows completion without photos', () => {
    expect(canComplete(stateOf(allButPhotos()))).toBe(true);
  });

  it('lists missing photos as a recommendation until actively skipped', () => {
    const w = allButPhotos();
    expect(missingRecommendations(stateOf(w)).map(r => r.id)).toEqual(['photos']);
    const skipped = { ...w, signOffs: { [PHOTOS_SKIPPED_KEY]: '2026-10-26T07:00:00Z' } };
    expect(missingRecommendations(stateOf(skipped))).toEqual([]);
  });

  it('still requires checklist and report without photos or customer sign-off', () => {
    const missing = missingRequirements(stateOf(emptyWork('ORD-3'))).map(m => m.id);
    expect(missing).toEqual(['checklist', 'report']);
  });

  it('allows completion without customer sign-off', () => {
    const w = { ...allButPhotos(), signature: '' };
    expect(canComplete(stateOf(w))).toBe(true);
    expect(missingRecommendations(stateOf(w)).map(r => r.id)).toEqual(['photos']);
  });

  it('requires the written installation report even when other requirements are met', () => {
    const w = {
      ...allButPhotos(),
      signature: '',
      reportText: 'Installationen är klar och testad.',
      reportSubmitted: false,
    };
    expect(canComplete(stateOf(w))).toBe(false);
    expect(missingRequirements(stateOf(w)).map(r => r.id)).toEqual(['report']);
    expect(canComplete(stateOf({ ...w, reportSubmitted: true }))).toBe(true);
  });

  it.each(PROJECT_TEMPLATES)('keeps photos and customer sign-off optional for $id orders', template => {
    const w = {
      ...emptyWork('ORD-TEMPLATE'),
      checkedItems: template.checklist.map(item => item.id),
      reportText: 'Installationen är klar och testad.',
      reportSubmitted: true,
      signOffs: Object.fromEntries(
        template.signOffs.filter(so => so.by === 'installer').map(so => [so.id, 'Test Montör']),
      ),
    };
    expect(w.photos).toEqual([]);
    expect(w.signature).toBe('');
    expect(canComplete(stateOf(w), template)).toBe(true);
    expect(missingRequirements(stateOf({ ...w, reportSubmitted: false }), template).map(r => r.id)).toEqual(['report']);
  });

  it('retains required installer sign-off on digital signage orders', () => {
    const template = PROJECT_TEMPLATES.find(t => t.id === 'digital-signage');
    if (!template) throw new Error('Digital signage template missing');
    const w = {
      ...emptyWork('ORD-SIGNAGE'),
      checkedItems: template.checklist.map(item => item.id),
      reportSubmitted: true,
    };
    expect(canComplete(stateOf(w), template)).toBe(false);
    expect(missingRequirements(stateOf(w), template).map(r => r.id)).toEqual(['signoff:installer']);
  });
});
