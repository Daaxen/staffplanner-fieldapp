import { ratesForClient, type Project } from '@/data/mockData';

/** Manual economy overrides stored on the project. */
export interface ProjectEconomy {
  /** Agreed fixed price (ex VAT). When set it replaces the hourly revenue calculation. */
  fixedPrice?: number;
  /** Extra invoiced revenue on top (ex VAT). */
  additionalRevenue?: number;
  /** Budgeted hours — falls back to the order's estimated hours. */
  budgetHours?: number;
  /** Internal cost per own-staff hour (SEK/h). */
  internalHourlyCost?: number;
  /** Cost per sub-vendor hour (SEK/h). */
  externalHourlyCost?: number;
  /** Invoices from sub-vendors / partners not logged as hours. */
  externalCostExtra?: number;
  /** Material purchases not logged as expenses. */
  materialCostExtra?: number;
  /** Travel costs not logged as expenses or mileage. */
  travelCostExtra?: number;
  /** Budget for external / sub-vendor costs (SEK). */
  externalBudget?: number;
  /** Target profitability % for this order. */
  targetMarginPct?: number;
}

export const DEFAULT_INTERNAL_HOURLY_COST = 420; // SEK/h, fully loaded own staff
export const DEFAULT_EXTERNAL_HOURLY_COST = 550; // SEK/h, sub-vendor

export interface ProfitabilityInput {
  project: Project;
  /** Logged hours split by whether the person is own staff or a sub-vendor. */
  internalHours: number;
  externalHours: number;
  /** Logged expenses, already summed per group (ex VAT). */
  materialExpenses: number;
  travelExpenses: number;
  otherExpenses: number;
  /** Mileage logged on the project. */
  mileageKm: number;
  mileageCost: number;
}

export interface Profitability {
  revenue: number;
  budgetHours: number;
  actualHours: number;
  hoursVariance: number;      // actual - budget
  internalCost: number;
  externalCost: number;
  travelCost: number;
  materialCost: number;
  otherCost: number;
  directCost: number;         // internal + external + material
  totalCost: number;          // direct + travel + other
  grossMargin: number;        // revenue - direct cost
  grossMarginPct: number;
  contributionMargin: number; // revenue - all variable cost
  contributionMarginPct: number;
  profitabilityPct: number;   // contribution margin / revenue
  revenueIsFixedPrice: boolean;
}

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export function computeProfitability(input: ProfitabilityInput): Profitability {
  const { project } = input;
  const eco: ProjectEconomy = project.economy ?? {};
  const rates = ratesForClient(project.client, project.clientId);
  const hourlyRate = project.hourlyRate ?? rates.hourlyRate;
  const mileageRate = project.mileageRate ?? rates.mileageRate;

  const actualHours = input.internalHours + input.externalHours;
  const budgetHours = eco.budgetHours ?? project.estimatedHours ?? 0;

  const billedHours = actualHours > 0 ? actualHours : budgetHours;
  const revenueIsFixedPrice = typeof eco.fixedPrice === 'number' && eco.fixedPrice > 0;
  const baseRevenue = revenueIsFixedPrice
    ? eco.fixedPrice!
    : billedHours * hourlyRate + input.mileageKm * mileageRate + input.materialExpenses;
  const revenue = baseRevenue + (eco.additionalRevenue ?? 0);

  const internalCost = input.internalHours * (eco.internalHourlyCost ?? DEFAULT_INTERNAL_HOURLY_COST);
  const externalCost =
    input.externalHours * (eco.externalHourlyCost ?? DEFAULT_EXTERNAL_HOURLY_COST) + (eco.externalCostExtra ?? 0);
  const materialCost = input.materialExpenses + (eco.materialCostExtra ?? 0);
  const travelCost = input.travelExpenses + input.mileageCost + (eco.travelCostExtra ?? 0);
  const otherCost = input.otherExpenses;

  const directCost = internalCost + externalCost + materialCost;
  const totalCost = directCost + travelCost + otherCost;
  const grossMargin = revenue - directCost;
  const contributionMargin = revenue - totalCost;

  return {
    revenue,
    budgetHours,
    actualHours,
    hoursVariance: actualHours - budgetHours,
    internalCost,
    externalCost,
    travelCost,
    materialCost,
    otherCost,
    directCost,
    totalCost,
    grossMargin,
    grossMarginPct: pct(grossMargin, revenue),
    contributionMargin,
    contributionMarginPct: pct(contributionMargin, revenue),
    profitabilityPct: pct(contributionMargin, revenue),
    revenueIsFixedPrice,
  };
}

export const emptyInput = (project: Project): ProfitabilityInput => ({
  project,
  internalHours: 0,
  externalHours: 0,
  materialExpenses: 0,
  travelExpenses: 0,
  otherExpenses: 0,
  mileageKm: 0,
  mileageCost: 0,
});

export type MarginLevel = 'good' | 'watch' | 'bad';

export const marginLevel = (percentage: number): MarginLevel =>
  percentage >= 25 ? 'good' : percentage >= 10 ? 'watch' : 'bad';

export const marginColor = (level: MarginLevel) =>
  level === 'good'
    ? 'text-status-completed'
    : level === 'watch'
      ? 'text-status-in-progress'
      : 'text-status-cancelled';

export const marginBg = (level: MarginLevel) =>
  level === 'good'
    ? 'bg-status-completed/15 border-status-completed/40'
    : level === 'watch'
      ? 'bg-status-in-progress/15 border-status-in-progress/40'
      : 'bg-status-cancelled/15 border-status-cancelled/40';

export const sek = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} SEK`;
export const pctLabel = (n: number) => `${n.toFixed(1)} %`;

/* ---------------------------------------------------------------- alerts */

/** Hours overrun tolerated before an alert fires. */
export const HOURS_OVERRUN_TOLERANCE_PCT = 10;
/** Default target profitability % per order. */
export const DEFAULT_TARGET_MARGIN_PCT = 25;

export type AlertKind = 'hours' | 'external' | 'margin';
export type AlertSeverity = 'warning' | 'critical';

export interface ProfitabilityAlert {
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
}

/** Warnings for one order: hours overrun, external cost overrun, margin below target. */
export function profitabilityAlerts(project: Project, result: Profitability): ProfitabilityAlert[] {
  const eco: ProjectEconomy = project.economy ?? {};
  const alerts: ProfitabilityAlert[] = [];

  if (result.budgetHours > 0 && result.actualHours > 0) {
    const overPct = ((result.actualHours - result.budgetHours) / result.budgetHours) * 100;
    if (overPct > HOURS_OVERRUN_TOLERANCE_PCT) {
      alerts.push({
        kind: 'hours',
        severity: overPct >= 25 ? 'critical' : 'warning',
        title: `Hours ${overPct.toFixed(0)} % over budget`,
        detail: `${result.actualHours} h logged against ${result.budgetHours} h budgeted.`,
      });
    }
  }

  const externalBudget = eco.externalBudget;
  if (typeof externalBudget === 'number' && externalBudget > 0 && result.externalCost > externalBudget) {
    const over = result.externalCost - externalBudget;
    alerts.push({
      kind: 'external',
      severity: over > externalBudget * 0.25 ? 'critical' : 'warning',
      title: 'External costs over budget',
      detail: `${sek(result.externalCost)} spent of ${sek(externalBudget)} budgeted (${sek(over)} over).`,
    });
  }

  const target = eco.targetMarginPct ?? DEFAULT_TARGET_MARGIN_PCT;
  if (result.revenue > 0 && result.profitabilityPct < target) {
    alerts.push({
      kind: 'margin',
      severity: result.profitabilityPct < target / 2 ? 'critical' : 'warning',
      title: `Margin below target (${pctLabel(target)})`,
      detail: `Profitability is ${pctLabel(result.profitabilityPct)} · contribution ${sek(result.contributionMargin)}.`,
    });
  }

  return alerts;
}

export const alertColor = (severity: AlertSeverity) =>
  severity === 'critical' ? 'text-status-cancelled' : 'text-status-in-progress';

export const alertBg = (severity: AlertSeverity) =>
  severity === 'critical'
    ? 'bg-status-cancelled/10 border-status-cancelled/40'
    : 'bg-status-in-progress/10 border-status-in-progress/40';
