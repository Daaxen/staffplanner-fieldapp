import { describe, it, expect } from 'vitest';
import {
  buildInvoiceSuggestion,
  DEFAULT_INVOICE_SETTINGS,
  scoreLevel,
  type InvoiceSettings,
} from '@/lib/invoicePrep';
import { emptyInput } from '@/lib/profitability';
import type { Project } from '@/data/mockData';

const project = (over: Partial<Project> = {}): Project =>
  ({
    id: 'O1',
    name: 'Order',
    projectType: 'installation',
    client: 'ACME',
    location: 'Stockholm',
    status: 'completed',
    assigneeIds: [],
    startDate: '2026-01-01',
    endDate: '2026-01-02',
    hourlyRate: 600,
    mileageRate: 25,
    ...over,
  }) as Project;

const ctx = (over: Partial<ReturnType<typeof emptyInput>> = {}, extra: { deviations?: number; submitted?: boolean; signed?: boolean } = {}) => ({
  input: { ...emptyInput(project()), ...over },
  report: {
    projectRef: 'O1',
    submittedAt: extra.submitted === false ? null : '2026-01-03T10:00:00Z',
    hasSignature: extra.signed !== false,
    photoCount: 3,
  },
  openDeviations: extra.deviations ?? 0,
});

const settings: InvoiceSettings = { ...DEFAULT_INVOICE_SETTINGS, expenseMarkupPct: 0 };

describe('invoice preparation', () => {
  it('builds lines from time, mileage and expenses', () => {
    const s = buildInvoiceSuggestion(
      project(),
      ctx({ internalHours: 10, mileageKm: 40, mileageCost: 1000, materialExpenses: 500 }),
      settings,
    );
    const labels = s.lines.map(l => l.label);
    expect(labels).toEqual(['Work', 'Mileage', 'Materials']);
    expect(s.revenue).toBe(10 * 600 + 40 * 25 + 500);
  });

  it('uses the agreed fixed price instead of hours', () => {
    const s = buildInvoiceSuggestion(
      project({ economy: { fixedPrice: 20000 } }),
      ctx({ internalHours: 10 }),
      settings,
    );
    expect(s.lines[0].label).toBe('Agreed fixed price');
    expect(s.revenue).toBe(20000);
  });

  it('reports revenue, costs and margin', () => {
    const s = buildInvoiceSuggestion(
      project(),
      ctx({ internalHours: 10, externalHours: 5, mileageCost: 500, materialExpenses: 1000 }),
      settings,
    );
    expect(s.internalCost).toBe(10 * DEFAULT_INVOICE_SETTINGS.internalHourlyCost);
    expect(s.externalCost).toBe(5 * DEFAULT_INVOICE_SETTINGS.externalHourlyCost);
    expect(s.mileageCost).toBe(500);
    expect(s.expenseCost).toBe(1000);
    expect(s.margin).toBe(s.revenue - s.totalCost);
  });

  it('honours the billing switches and markups', () => {
    const noExtras = buildInvoiceSuggestion(
      project(),
      ctx({ internalHours: 4, mileageKm: 100, materialExpenses: 1000 }),
      { ...settings, billMileage: false, billMaterials: false },
    );
    expect(noExtras.revenue).toBe(4 * 600);

    const marked = buildInvoiceSuggestion(
      project(),
      ctx({ materialExpenses: 1000 }),
      { ...settings, billHours: false, expenseMarkupPct: 20 },
    );
    expect(marked.revenue).toBe(1200);
  });

  it('scores a complete order as ready', () => {
    const s = buildInvoiceSuggestion(project({ economy: { fixedPrice: 50000 } }), ctx({ internalHours: 10 }), settings);
    expect(s.warnings).toHaveLength(0);
    expect(s.score).toBe(100);
    expect(s.ready).toBe(true);
  });

  it('warns about missing report, sign-off and open deviations', () => {
    const s = buildInvoiceSuggestion(
      project({ economy: { fixedPrice: 50000 } }),
      ctx({ internalHours: 10 }, { submitted: false, signed: false, deviations: 2 }),
      settings,
    );
    const codes = s.warnings.map(w => w.code);
    expect(codes).toContain('missing-report');
    expect(codes).toContain('missing-sign-off');
    expect(codes).toContain('open-deviation');
    expect(s.score).toBe(100 - 35 - 25 - 20);
    expect(s.ready).toBe(false);
  });

  it('warns when nothing is reported and when the margin is below target', () => {
    const empty = buildInvoiceSuggestion(project(), ctx(), settings);
    expect(empty.warnings.map(w => w.code)).toContain('no-hours');

    const thin = buildInvoiceSuggestion(
      project({ hourlyRate: 400, economy: { internalHourlyCost: 380 } }),
      ctx({ internalHours: 10 }),
      settings,
    );
    expect(thin.warnings.map(w => w.code)).toContain('low-margin');
  });

  it('respects a configurable ready threshold and penalties', () => {
    const lenient = buildInvoiceSuggestion(
      project({ economy: { fixedPrice: 50000 } }),
      ctx({ internalHours: 10 }, { submitted: false }),
      { ...settings, penaltyMissingReport: 5, readyThreshold: 90 },
    );
    expect(lenient.score).toBe(95);
    expect(lenient.ready).toBe(true);
  });

  it('grades the score', () => {
    expect(scoreLevel(90)).toBe('good');
    expect(scoreLevel(60)).toBe('watch');
    expect(scoreLevel(20)).toBe('bad');
  });
});
