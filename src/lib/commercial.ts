import type { Project } from '@/data/mockData';

/** Commercial (sales/invoicing) track for an order. Runs alongside the
 *  operational work status, which stays the planner's source of truth. */
export type CommercialStatus =
  | 'quote'
  | 'order_received'
  | 'planned'
  | 'scheduled'
  | 'in_progress'
  | 'ready_for_invoice'
  | 'invoiced'
  | 'paid'
  | 'closed';

export const COMMERCIAL_STATUSES: CommercialStatus[] = [
  'quote',
  'order_received',
  'planned',
  'scheduled',
  'in_progress',
  'ready_for_invoice',
  'invoiced',
  'paid',
  'closed',
];

export const commercialLabels: Record<CommercialStatus, string> = {
  quote: 'Quote',
  order_received: 'Order Received',
  planned: 'Planned',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  ready_for_invoice: 'Ready For Invoice',
  invoiced: 'Invoiced',
  paid: 'Paid',
  closed: 'Closed',
};

/** Mirrors ref_commercial_status_transition in the database. */
export const COMMERCIAL_TRANSITIONS: Record<CommercialStatus, CommercialStatus[]> = {
  quote: ['order_received', 'closed'],
  order_received: ['planned', 'quote', 'closed'],
  planned: ['scheduled', 'order_received', 'closed'],
  scheduled: ['in_progress', 'planned', 'closed'],
  in_progress: ['ready_for_invoice', 'scheduled', 'closed'],
  ready_for_invoice: ['invoiced', 'in_progress', 'closed'],
  invoiced: ['paid', 'ready_for_invoice', 'closed'],
  paid: ['closed', 'invoiced'],
  closed: ['paid'],
};

export const commercialStatusOf = (p: Project): CommercialStatus =>
  (p.commercialStatus ?? 'quote') as CommercialStatus;

export const canTransitionCommercial = (from: CommercialStatus, to: CommercialStatus) =>
  from === to || (COMMERCIAL_TRANSITIONS[from] ?? []).includes(to);

export const commercialTransitionError = (from: CommercialStatus, to: CommercialStatus) =>
  canTransitionCommercial(from, to)
    ? null
    : `${commercialLabels[from]} cannot go straight to ${commercialLabels[to]}`;

/** Order value used for pipeline and invoicing figures. */
export const orderValue = (p: Project): number => {
  const e = p.economy;
  const fixed = (e?.fixedPrice ?? 0) + (e?.additionalRevenue ?? 0);
  if (fixed > 0) return fixed;
  const hours = e?.budgetHours ?? p.estimatedHours ?? 0;
  return hours * (p.hourlyRate ?? 0);
};

export interface CommercialMetrics {
  pipelineValue: number;
  pipelineCount: number;
  inProduction: number;
  inProductionValue: number;
  readyForInvoice: number;
  readyForInvoiceValue: number;
  outstanding: number;
  outstandingValue: number;
  paid: number;
  paidValue: number;
  byStatus: Record<CommercialStatus, { count: number; value: number }>;
}

const EMPTY = () =>
  COMMERCIAL_STATUSES.reduce((acc, s) => {
    acc[s] = { count: 0, value: 0 };
    return acc;
  }, {} as Record<CommercialStatus, { count: number; value: number }>);

export const computeCommercialMetrics = (projects: Project[]): CommercialMetrics => {
  const byStatus = EMPTY();
  for (const p of projects) {
    const s = commercialStatusOf(p);
    const v = orderValue(p);
    byStatus[s].count += 1;
    byStatus[s].value += v;
  }
  const sum = (...list: CommercialStatus[]) =>
    list.reduce(
      (acc, s) => ({ count: acc.count + byStatus[s].count, value: acc.value + byStatus[s].value }),
      { count: 0, value: 0 },
    );

  const pipeline = sum('quote');
  const production = sum('order_received', 'planned', 'scheduled', 'in_progress');
  const ready = sum('ready_for_invoice');
  const outstanding = sum('invoiced');
  const paid = sum('paid', 'closed');

  return {
    pipelineValue: pipeline.value,
    pipelineCount: pipeline.count,
    inProduction: production.count,
    inProductionValue: production.value,
    readyForInvoice: ready.count,
    readyForInvoiceValue: ready.value,
    outstanding: outstanding.count,
    outstandingValue: outstanding.value,
    paid: paid.count,
    paidValue: paid.value,
    byStatus,
  };
};

export const commercialGroup: Record<CommercialStatus, 'pipeline' | 'production' | 'ready' | 'outstanding' | 'paid'> = {
  quote: 'pipeline',
  order_received: 'production',
  planned: 'production',
  scheduled: 'production',
  in_progress: 'production',
  ready_for_invoice: 'ready',
  invoiced: 'outstanding',
  paid: 'paid',
  closed: 'paid',
};
