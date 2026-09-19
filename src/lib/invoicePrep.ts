import { ratesForClient, type Project } from '@/data/mockData';
import {
  DEFAULT_EXTERNAL_HOURLY_COST,
  DEFAULT_INTERNAL_HOURLY_COST,
  type ProfitabilityInput,
} from '@/lib/profitability';
import type { FieldReportState } from '@/lib/operations';
import { commercialStatusOf, type CommercialStatus } from '@/lib/commercial';

/** Every figure in the invoice suggestion is driven by these settings, so the
 *  office can tune billing rules without a code change. Stored per browser. */
export interface InvoiceSettings {
  /** Bill logged hours (off for pure fixed-price work). */
  billHours: boolean;
  /** Bill mileage to the customer. */
  billMileage: boolean;
  /** Bill material purchases. */
  billMaterials: boolean;
  /** Bill travel expenses (parking, tickets…). */
  billTravel: boolean;
  /** Bill other expenses. */
  billOther: boolean;
  /** Percentage added on re-billed expenses and materials. */
  expenseMarkupPct: number;
  /** Percentage added on re-billed mileage. */
  mileageMarkupPct: number;
  /** Fallback cost per own-staff hour when the order has no override. */
  internalHourlyCost: number;
  /** Fallback cost per sub-vendor hour when the order has no override. */
  externalHourlyCost: number;
  /** Margin below this is flagged on the suggestion. */
  targetMarginPct: number;
  /** Readiness deductions. */
  penaltyMissingReport: number;
  penaltyMissingSignOff: number;
  penaltyOpenDeviation: number;
  penaltyNoHours: number;
  penaltyLowMargin: number;
  penaltyNegativeMargin: number;
  /** Minimum score before an order counts as ready to invoice. */
  readyThreshold: number;
}

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  billHours: true,
  billMileage: true,
  billMaterials: true,
  billTravel: true,
  billOther: false,
  expenseMarkupPct: 10,
  mileageMarkupPct: 0,
  internalHourlyCost: DEFAULT_INTERNAL_HOURLY_COST,
  externalHourlyCost: DEFAULT_EXTERNAL_HOURLY_COST,
  targetMarginPct: 25,
  penaltyMissingReport: 35,
  penaltyMissingSignOff: 25,
  penaltyOpenDeviation: 20,
  penaltyNoHours: 30,
  penaltyLowMargin: 10,
  penaltyNegativeMargin: 40,
  readyThreshold: 80,
};

const SETTINGS_KEY = 'invoiceSettings';

export const loadInvoiceSettings = (): InvoiceSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_INVOICE_SETTINGS, ...(JSON.parse(raw) as Partial<InvoiceSettings>) } : DEFAULT_INVOICE_SETTINGS;
  } catch {
    return DEFAULT_INVOICE_SETTINGS;
  }
};

export const saveInvoiceSettings = (s: InvoiceSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
};

export interface InvoiceLine {
  label: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface InvoiceWarning {
  code: 'missing-report' | 'missing-sign-off' | 'open-deviation' | 'no-hours' | 'low-margin' | 'negative-margin';
  label: string;
  penalty: number;
}

export interface InvoiceSuggestion {
  project: Project;
  commercialStatus: CommercialStatus;
  lines: InvoiceLine[];
  revenue: number;
  internalCost: number;
  externalCost: number;
  mileageCost: number;
  materialCost: number;
  travelCost: number;
  expenseCost: number;
  totalCost: number;
  margin: number;
  marginPct: number;
  hours: number;
  score: number;
  ready: boolean;
  warnings: InvoiceWarning[];
}

export interface InvoiceContext {
  input: ProfitabilityInput;
  report?: FieldReportState;
  openDeviations: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function buildInvoiceSuggestion(
  project: Project,
  ctx: InvoiceContext,
  settings: InvoiceSettings,
): InvoiceSuggestion {
  const { input, report, openDeviations } = ctx;
  const eco = project.economy ?? {};
  const rates = ratesForClient(project.client, project.clientId);
  const hourlyRate = project.hourlyRate ?? rates.hourlyRate;
  const mileageRate = project.mileageRate ?? rates.mileageRate;

  const hours = input.internalHours + input.externalHours;
  const lines: InvoiceLine[] = [];

  const fixedPrice = typeof eco.fixedPrice === 'number' && eco.fixedPrice > 0 ? eco.fixedPrice : 0;
  if (fixedPrice > 0) {
    lines.push({ label: 'Agreed fixed price', quantity: 1, unit: 'st', rate: fixedPrice, amount: fixedPrice });
  } else if (settings.billHours && hours > 0) {
    lines.push({ label: 'Work', quantity: round(hours), unit: 'h', rate: hourlyRate, amount: round(hours * hourlyRate) });
  }

  if (settings.billMileage && input.mileageKm > 0) {
    const rate = round(mileageRate * (1 + settings.mileageMarkupPct / 100));
    lines.push({ label: 'Mileage', quantity: round(input.mileageKm), unit: 'km', rate, amount: round(input.mileageKm * rate) });
  }
  const markup = 1 + settings.expenseMarkupPct / 100;
  if (settings.billMaterials && input.materialExpenses > 0) {
    lines.push({ label: 'Materials', quantity: 1, unit: 'st', rate: round(input.materialExpenses * markup), amount: round(input.materialExpenses * markup) });
  }
  if (settings.billTravel && input.travelExpenses > 0) {
    lines.push({ label: 'Travel expenses', quantity: 1, unit: 'st', rate: round(input.travelExpenses * markup), amount: round(input.travelExpenses * markup) });
  }
  if (settings.billOther && input.otherExpenses > 0) {
    lines.push({ label: 'Other expenses', quantity: 1, unit: 'st', rate: round(input.otherExpenses * markup), amount: round(input.otherExpenses * markup) });
  }
  if (eco.additionalRevenue) {
    lines.push({ label: 'Additional revenue', quantity: 1, unit: 'st', rate: eco.additionalRevenue, amount: eco.additionalRevenue });
  }

  const revenue = round(lines.reduce((sum, l) => sum + l.amount, 0));

  const internalCost = round(input.internalHours * (eco.internalHourlyCost ?? settings.internalHourlyCost));
  const externalCost = round(
    input.externalHours * (eco.externalHourlyCost ?? settings.externalHourlyCost) + (eco.externalCostExtra ?? 0),
  );
  const mileageCost = round(input.mileageCost + (eco.travelCostExtra ?? 0));
  const materialCost = round(input.materialExpenses + (eco.materialCostExtra ?? 0));
  const travelCost = round(input.travelExpenses + mileageCost);
  const expenseCost = round(
    input.materialExpenses + input.travelExpenses + input.otherExpenses + (eco.materialCostExtra ?? 0),
  );
  const totalCost = round(internalCost + externalCost + mileageCost + expenseCost);
  const margin = round(revenue - totalCost);
  const marginPct = revenue > 0 ? round((margin / revenue) * 100) : 0;

  const targetMargin = eco.targetMarginPct ?? settings.targetMarginPct;
  const warnings: InvoiceWarning[] = [];
  if (!report?.submittedAt) {
    warnings.push({ code: 'missing-report', label: 'Installation report not submitted', penalty: settings.penaltyMissingReport });
  }
  if (!report?.hasSignature) {
    warnings.push({ code: 'missing-sign-off', label: 'Customer sign-off missing', penalty: settings.penaltyMissingSignOff });
  }
  if (openDeviations > 0) {
    warnings.push({
      code: 'open-deviation',
      label: `${openDeviations} open deviation${openDeviations === 1 ? '' : 's'}`,
      penalty: settings.penaltyOpenDeviation,
    });
  }
  if (hours === 0 && fixedPrice === 0) {
    warnings.push({ code: 'no-hours', label: 'Incomplete time reporting — no hours logged and no fixed price', penalty: settings.penaltyNoHours });
  }
  if (margin < 0) {
    warnings.push({
      code: 'negative-margin',
      label: 'Negative margin — the order costs more than it brings in',
      penalty: settings.penaltyNegativeMargin,
    });
  } else if (revenue > 0 && marginPct < targetMargin) {
    warnings.push({
      code: 'low-margin',
      label: `Margin ${marginPct.toFixed(1)} % is below the ${targetMargin} % target`,
      penalty: settings.penaltyLowMargin,
    });
  }

  const score = Math.max(0, 100 - warnings.reduce((sum, w) => sum + w.penalty, 0));

  return {
    project,
    commercialStatus: commercialStatusOf(project),
    lines,
    revenue,
    internalCost,
    externalCost,
    mileageCost,
    materialCost,
    travelCost,
    expenseCost,
    totalCost,
    margin,
    marginPct,
    hours: round(hours),
    score,
    ready: score >= settings.readyThreshold,
    warnings,
  };
}

export const scoreLevel = (score: number): 'good' | 'watch' | 'bad' =>
  score >= 80 ? 'good' : score >= 50 ? 'watch' : 'bad';

export const scoreColor = (level: 'good' | 'watch' | 'bad') =>
  level === 'good' ? 'text-status-completed' : level === 'watch' ? 'text-status-on-hold' : 'text-destructive';
