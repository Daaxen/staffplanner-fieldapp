import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMMERCIAL_STATUSES,
  COMMERCIAL_TRANSITIONS,
  canTransitionCommercial,
  commercialTransitionError,
  commercialLabels,
  computeCommercialMetrics,
  orderValue,
} from '@/lib/commercial';
import type { Project } from '@/data/mockData';

const migrations = readdirSync(join(process.cwd(), 'supabase/migrations'))
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(process.cwd(), 'supabase/migrations', f), 'utf8'))
  .join('\n');

const order = (over: Partial<Project>): Project =>
  ({
    id: over.id ?? 'O1',
    name: 'Order',
    projectType: 'installation',
    client: 'ACME',
    location: 'Stockholm',
    status: 'open',
    assigneeIds: [],
    startDate: '2026-01-01',
    endDate: '2026-01-02',
    ...over,
  }) as Project;

describe('commercial workflow', () => {
  it('has all nine lifecycle states with labels', () => {
    expect(COMMERCIAL_STATUSES).toHaveLength(9);
    for (const s of COMMERCIAL_STATUSES) expect(commercialLabels[s]).toBeTruthy();
  });

  it('allows only the approved next steps', () => {
    expect(canTransitionCommercial('quote', 'order_received')).toBe(true);
    expect(canTransitionCommercial('quote', 'invoiced')).toBe(false);
    expect(canTransitionCommercial('scheduled', 'paid')).toBe(false);
    expect(canTransitionCommercial('ready_for_invoice', 'invoiced')).toBe(true);
    expect(canTransitionCommercial('invoiced', 'paid')).toBe(true);
  });

  it('always allows closing and one step back', () => {
    for (const s of COMMERCIAL_STATUSES) {
      if (s === 'closed') continue;
      expect(COMMERCIAL_TRANSITIONS[s]).toContain('closed');
    }
    expect(canTransitionCommercial('invoiced', 'ready_for_invoice')).toBe(true);
  });

  it('explains a blocked step', () => {
    expect(commercialTransitionError('quote', 'paid')).toContain('cannot go straight to');
    expect(commercialTransitionError('quote', 'order_received')).toBeNull();
  });

  it('values an order from its fixed price, else budget hours', () => {
    expect(orderValue(order({ economy: { fixedPrice: 10000, additionalRevenue: 2000 } }))).toBe(12000);
    expect(orderValue(order({ estimatedHours: 10, hourlyRate: 650 }))).toBe(6500);
  });

  it('computes the five dashboard metrics', () => {
    const m = computeCommercialMetrics([
      order({ id: 'a', commercialStatus: 'quote', economy: { fixedPrice: 10000 } }),
      order({ id: 'b', commercialStatus: 'in_progress', economy: { fixedPrice: 5000 } }),
      order({ id: 'c', commercialStatus: 'ready_for_invoice', economy: { fixedPrice: 3000 } }),
      order({ id: 'd', commercialStatus: 'invoiced', economy: { fixedPrice: 7000 } }),
      order({ id: 'e', commercialStatus: 'paid', economy: { fixedPrice: 4000 } }),
      order({ id: 'f', commercialStatus: 'closed', economy: { fixedPrice: 1000 } }),
    ]);
    expect(m.pipelineValue).toBe(10000);
    expect(m.inProduction).toBe(1);
    expect(m.readyForInvoice).toBe(1);
    expect(m.outstandingValue).toBe(7000);
    expect(m.paid).toBe(2);
    expect(m.paidValue).toBe(5000);
  });

  it('treats an order with no commercial state as a quote', () => {
    const m = computeCommercialMetrics([order({ economy: { fixedPrice: 500 } })]);
    expect(m.pipelineCount).toBe(1);
  });

  it('enforces the same rules in the database', () => {
    expect(migrations).toContain('ref_commercial_status_transition');
    expect(migrations).toContain('validate_commercial_status_change');
    expect(migrations).toContain('Commercial status cannot go from');
    expect(migrations).toContain('commercial_status_events');
    expect(migrations).toMatch(/trg_projects_commercial_transition[\s\S]{0,200}validate_commercial_status_change/);
  });

  it('audits commercial transitions', () => {
    expect(migrations).toMatch(/audit_row_change\(\s*'project','name','status','commercial_status'/);
    expect(migrations).toMatch(/trg_audit_commercial_events[\s\S]{0,200}audit_row_change/);
  });

  it('keeps the app transition table in step with the database', () => {
    for (const [from, tos] of Object.entries(COMMERCIAL_TRANSITIONS)) {
      for (const to of tos) {
        expect(migrations).toContain(`('${from}','${to}')`);
      }
    }
  });
});
