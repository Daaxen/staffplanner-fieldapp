/**
 * Foreign-work counters & compliance monitoring.
 * Facts come from the DB function `foreign_work_days` (one row per installer/country/day).
 * This module only aggregates and evaluates configurable rules. It never draws legal conclusions.
 */
export type Verification = 'VERIFIED' | 'DERIVED' | 'MANUALLY_CONFIRMED' | 'INSUFFICIENT_DATA' | 'VOIDED';
export type Metric = 'WORK_DAYS' | 'PRESENCE_DAYS' | 'CONTINUOUS_ASSIGNMENT_DURATION';
export type WindowType = 'CALENDAR_YEAR' | 'ROLLING_12_MONTHS' | 'FIXED_DATE_RANGE' | 'CONTINUOUS_ASSIGNMENT';
export type FlagStatus = 'NORMAL' | 'WATCH' | 'REVIEW' | 'REACHED' | 'NOT_VERIFIED';
export type DocStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'MISSING' | 'NOT_REQUIRED' | 'NOT_VERIFIED';
export { COUNTRY_NAMES, countryName, normalizeCountry, destinationEvidence } from './countries';

export interface ForeignDay {
  installer_id: string;
  country: string;
  day: string; // YYYY-MM-DD
  is_work: boolean;
  is_presence: boolean;
  work_source: string | null;
  presence_source: string | null;
  verification: Verification;
  project_ids: string[] | null;
  conflict: boolean;
}

export interface ForeignRule {
  id: string;
  name: string;
  countries: string[];
  metric: Metric;
  window_type: WindowType;
  window_start: string | null;
  window_end: string | null;
  watch_threshold: number;
  review_threshold: number;
  critical_threshold: number;
  effective_from: string;
  effective_to: string | null;
  enabled: boolean;
  explanation: string | null;
}

export const STATUS_LABEL: Record<FlagStatus, string> = {
  NORMAL: 'NORMAL',
  WATCH: 'BEVAKA',
  REVIEW: 'KONTROLL KRÄVS',
  REACHED: 'GRÄNSVÄRDE UPPNÅTT',
  NOT_VERIFIED: 'EJ VERIFIERAD',
};
export const STATUS_RANK: Record<FlagStatus, number> = { NORMAL: 0, NOT_VERIFIED: 1, WATCH: 2, REVIEW: 3, REACHED: 4 };
export const VERIFICATION_LABEL: Record<Verification, string> = {
  VERIFIED: 'Verifierad', DERIVED: 'Härledd', MANUALLY_CONFIRMED: 'Manuellt bekräftad', INSUFFICIENT_DATA: 'Otillräckliga data', VOIDED: 'Makulerad',
};
export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  VALID: 'Giltig', EXPIRING: 'Går ut snart', EXPIRED: 'Utgången', MISSING: 'Saknas', NOT_REQUIRED: 'Krävs ej', NOT_VERIFIED: 'Ej verifierad',
};
export const METRIC_LABEL: Record<Metric, string> = {
  WORK_DAYS: 'Arbetsdagar', PRESENCE_DAYS: 'Vistelsedagar', CONTINUOUS_ASSIGNMENT_DURATION: 'Sammanhängande uppdrag (dagar)',
};
export const WINDOW_LABEL: Record<WindowType, string> = {
  CALENDAR_YEAR: 'Kalenderår', ROLLING_12_MONTHS: 'Rullande 12 månader', FIXED_DATE_RANGE: 'Fast datumintervall', CONTINUOUS_ASSIGNMENT: 'Sammanhängande uppdrag',
};

/** Date helpers work purely on YYYY-MM-DD strings (no timezone drift). */
const toUTC = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const addDays = (d: string, n: number) => new Date(toUTC(d) + n * 86400000).toISOString().slice(0, 10);
export const daysBetweenInclusive = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86400000) + 1;
export const datesInRange = (a: string, b: string) => {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
};

/** Deduplicate to one fact per installer/country/day (the DB already does this; guard for merged sources). */
export function dedupeDays(days: ForeignDay[]): ForeignDay[] {
  const map = new Map<string, ForeignDay>();
  for (const d of days) {
    const k = `${d.installer_id}|${d.country}|${d.day}`;
    const prev = map.get(k);
    if (d.verification === 'VOIDED') continue;
    if (!prev) map.set(k, { ...d, project_ids: [...(d.project_ids ?? [])] });
    else {
      const confirmed = (x: ForeignDay) => x.presence_source === 'presence_period' && ['VERIFIED', 'MANUALLY_CONFIRMED'].includes(x.verification);
      const ver = ['INSUFFICIENT_DATA', 'DERIVED', 'MANUALLY_CONFIRMED', 'VERIFIED'] as Verification[];
      map.set(k, { ...prev, is_work: prev.is_work || d.is_work, is_presence: prev.is_presence || d.is_presence,
        presence_source: confirmed(prev) || confirmed(d) ? 'presence_period' : [prev.presence_source, d.presence_source].filter(Boolean).sort()[0] ?? null,
        work_source: [prev.work_source, d.work_source].filter(Boolean).sort()[0] ?? null,
        verification: ver[Math.max(ver.indexOf(prev.verification), ver.indexOf(d.verification))] ?? 'INSUFFICIENT_DATA',
        project_ids: [...new Set([...(prev.project_ids ?? []), ...(d.project_ids ?? [])])].sort(), conflict: prev.conflict || d.conflict });
    }
  }
  return [...map.values()];
}

export interface Counter { work: number; presence: number; confirmedPresence: number; inferredPresence: number; verifiedWork: number; derivedWork: number; presenceVerified: boolean; unresolved: number; first: string | null; last: string | null; verification: Verification; conflicts: number; projectIds: string[] }

const VER_ORDER: Verification[] = ['INSUFFICIENT_DATA', 'DERIVED', 'MANUALLY_CONFIRMED', 'VERIFIED'];
export function countDays(days: ForeignDay[]): Counter {
  const d = dedupeDays(days);
  let first: string | null = null, last: string | null = null, worst = 3, conflicts = 0;
  const pids = new Set<string>();
  for (const x of d) {
    if (!first || x.day < first) first = x.day;
    if (!last || x.day > last) last = x.day;
    worst = Math.min(worst, Math.max(0, VER_ORDER.indexOf(x.verification)));
    if (x.conflict) conflicts++;
    (x.project_ids ?? []).forEach(p => pids.add(p));
  }
  return {
    work: d.filter(x => x.is_work).length,
    presence: d.filter(x => x.is_presence).length,
    confirmedPresence: d.filter(x => x.is_presence && x.presence_source === 'presence_period').length,
    inferredPresence: d.filter(x => x.is_presence && x.presence_source !== 'presence_period').length,
    verifiedWork: d.filter(x => x.is_work && ['VERIFIED', 'MANUALLY_CONFIRMED'].includes(x.verification) && x.work_source !== 'time_entry').length,
    derivedWork: d.filter(x => x.is_work && (x.verification === 'DERIVED' || x.work_source === 'time_entry')).length,
    presenceVerified: d.some(x => x.is_presence && x.presence_source === 'presence_period') && !d.some(x => x.is_presence && x.presence_source !== 'presence_period'),
    unresolved: d.filter(x => x.verification === 'INSUFFICIENT_DATA').length,
    first, last, conflicts,
    verification: d.length ? VER_ORDER[worst] : 'INSUFFICIENT_DATA',
    projectIds: [...pids],
  };
}

/** Longest run of consecutive presence days ending inside [from,to]. */
export function longestContinuous(days: ForeignDay[]): number {
  const sorted = [...new Set(dedupeDays(days).filter(d => d.is_presence && d.presence_source === 'presence_period').map(d => d.day))].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function ruleActive(rule: ForeignRule, asOf: string) {
  if (!rule.enabled) return false;
  if (rule.effective_from > asOf) return false;
  if (rule.effective_to && rule.effective_to < asOf) return false;
  return true;
}
export const ruleAppliesTo = (rule: ForeignRule, country: string) => rule.countries.length === 0 || rule.countries.includes(country);

/** Measurement window for a rule as of a date. null = cannot be calculated safely. */
export function ruleWindow(rule: ForeignRule, asOf: string): { from: string; to: string } | null {
  switch (rule.window_type) {
    case 'CALENDAR_YEAR': return { from: `${asOf.slice(0, 4)}-01-01`, to: asOf };
    case 'ROLLING_12_MONTHS': {
      const y = +asOf.slice(0, 4) - 1;
      let from = `${y}${asOf.slice(4)}`;
      if (from.endsWith('-02-29')) from = `${y}-03-01`; else from = addDays(from, 1);
      return { from, to: asOf };
    }
    case 'FIXED_DATE_RANGE':
    case 'CONTINUOUS_ASSIGNMENT': return rule.window_start && rule.window_end && rule.window_start <= rule.window_end && daysBetweenInclusive(rule.window_start, rule.window_end) <= 1101
      ? { from: rule.window_start, to: rule.window_end < asOf ? rule.window_end : asOf } : null;
  }
}

export function statusFor(value: number, rule: Pick<ForeignRule, 'watch_threshold' | 'review_threshold' | 'critical_threshold'>): FlagStatus {
  if (value >= rule.critical_threshold) return 'REACHED';
  if (value >= rule.review_threshold) return 'REVIEW';
  if (value >= rule.watch_threshold) return 'WATCH';
  return 'NORMAL';
}

export interface Flag {
  rule: ForeignRule; country: string; window: { from: string; to: string } | null;
  value: number | null; status: FlagStatus; nextThreshold: number | null; remaining: number | null; dayCount: number;
}

export function nextThreshold(value: number, r: ForeignRule): number | null {
  return [r.watch_threshold, r.review_threshold, r.critical_threshold].find(t => t > value) ?? null;
}

/** Evaluate one rule for one installer+country. `days` must cover the rule window. */
export function evaluateRule(rule: ForeignRule, country: string, days: ForeignDay[], asOf: string, homeConfigured = true): Flag | null {
  if (!ruleActive(rule, asOf) || !ruleAppliesTo(rule, country)) return null;
  const window = ruleWindow(rule, asOf);
  if (!homeConfigured || !window) return { rule, country, window, value: null, status: 'NOT_VERIFIED', nextThreshold: null, remaining: null, dayCount: 0 };
  const inWin = days.filter(d => d.country === country && d.day >= window.from && d.day <= window.to);
  const counter = countDays(inWin);
  if (counter.unresolved || (rule.metric !== 'WORK_DAYS' && !counter.presenceVerified)) return { rule, country, window, value: null, status: 'NOT_VERIFIED', nextThreshold: null, remaining: null, dayCount: inWin.length };
  const value = rule.metric === 'WORK_DAYS' ? counter.work
    : rule.metric === 'PRESENCE_DAYS' ? counter.confirmedPresence
    : longestContinuous(inWin);
  const nt = nextThreshold(value, rule);
  return { rule, country, window, value, status: statusFor(value, rule), nextThreshold: nt, remaining: nt == null ? null : nt - value, dayCount: inWin.length };
}

export function worstStatus(flags: (Flag | null)[]): FlagStatus {
  return flags.reduce<FlagStatus>((w, f) => (f && STATUS_RANK[f.status] > STATUS_RANK[w] ? f.status : w), 'NORMAL');
}

/** Projected impact of a booking: adds only days not already counted. Missing dates -> NOT_VERIFIED. */
export function projectBooking(rule: ForeignRule, country: string, days: ForeignDay[], asOf: string,
  booking: { installer_id: string; start?: string | null; end?: string | null; worksWeekends?: boolean; presenceStart?: string | null; presenceEnd?: string | null }) {
  const current = evaluateRule(rule, country, days, asOf);
  if (!current) return null;
  const presenceMetric = rule.metric !== 'WORK_DAYS';
  const start = presenceMetric ? booking.presenceStart : booking.start, end = presenceMetric ? booking.presenceEnd : booking.end;
  if (!start || !end || end < start || daysBetweenInclusive(start, end) > 1101 || current.status === 'NOT_VERIFIED') return { current, added: null, projected: null, status: 'NOT_VERIFIED' as FlagStatus };
  const existing = new Set(days.filter(d => d.country === country && (presenceMetric ? d.is_presence && d.presence_source === 'presence_period' : d.is_work)).map(d => d.day));
  const extra: ForeignDay[] = datesInRange(start, end).filter(d => presenceMetric || booking.worksWeekends || ![0, 6].includes(new Date(toUTC(d)).getUTCDay())).filter(d => !existing.has(d)).map(day => ({
    installer_id: booking.installer_id, country, day, is_work: !presenceMetric, is_presence: presenceMetric, work_source: 'projected_booking', presence_source: presenceMetric ? 'presence_period' : null, verification: 'DERIVED', project_ids: [], conflict: false,
  }));
  const evalAt = end > asOf ? end : asOf;
  const projected = evaluateRule(rule, country, [...days, ...extra], evalAt);
  return { current, added: extra.length, projected: projected?.value ?? null, status: projected?.status ?? 'NOT_VERIFIED', projectedOnly: true };
}

export function docStatus(doc: { status: DocStatus; valid_from: string | null; valid_to: string | null; expiry_warning_days?: number } | null, asOf: string, expiringDays = doc?.expiry_warning_days ?? 30): DocStatus {
  if (!doc) return 'MISSING';
  if (['NOT_REQUIRED', 'NOT_VERIFIED', 'MISSING'].includes(doc.status)) return doc.status;
  if (!doc.valid_to || !doc.valid_from) return 'NOT_VERIFIED';
  if (doc.valid_to < asOf) return 'EXPIRED';
  if (doc.valid_from > asOf) return 'NOT_VERIFIED';
  if (doc.valid_to <= addDays(asOf, expiringDays)) return 'EXPIRING';
  return 'VALID';
}

export interface CountrySummary { country: string; counter: Counter; flags: Flag[]; status: FlagStatus; next: Flag | null }

/** Shared by installer card, admin report and export so totals never diverge. */
export function summarizeInstaller(installerId: string, days: ForeignDay[], rules: ForeignRule[], period: { from: string; to: string }, asOf: string, homeConfigured: boolean): CountrySummary[] {
  const mine = days.filter(d => d.installer_id === installerId);
  const countries = [...new Set(mine.map(d => d.country))].sort();
  return countries.map(country => {
    const inPeriod = mine.filter(d => d.country === country && d.day >= period.from && d.day <= period.to && d.day <= asOf);
    const flags = rules.map(r => evaluateRule(r, country, mine, asOf, homeConfigured)).filter(Boolean) as Flag[];
    const next = flags.filter(f => f.remaining != null).sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity))[0] ?? null;
    let status = worstStatus(flags);
    if (!homeConfigured || countDays(inPeriod).unresolved || !countDays(inPeriod).presenceVerified) status = status === 'NORMAL' ? 'NOT_VERIFIED' : status;
    return { country, counter: countDays(inPeriod), flags, status, next };
  }).filter(s => s.counter.work > 0 || s.counter.presence > 0 || s.counter.unresolved > 0 || s.flags.some(f => (f.value ?? 0) > 0));
}

export function reportWindow(mode: 'year' | 'rolling' | 'range', year: string, range: { from: string; to: string }, asOf: string) {
  if (mode === 'rolling') return ruleWindow({ window_type: 'ROLLING_12_MONTHS' } as ForeignRule, asOf) ?? range;
  const w = mode === 'year' ? { from: `${year}-01-01`, to: `${year}-12-31` } : range;
  return { from: w.from, to: w.to < asOf ? w.to : asOf };
}
