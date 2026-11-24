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
export const COUNTRY_NAMES: Record<string, string> = {
  SE: 'Sverige', NO: 'Norge', FI: 'Finland', DK: 'Danmark', DE: 'Tyskland', IS: 'Island', EE: 'Estland', LV: 'Lettland',
  LT: 'Litauen', PL: 'Polen', NL: 'Nederländerna', BE: 'Belgien', FR: 'Frankrike', GB: 'Storbritannien', ES: 'Spanien',
  IT: 'Italien', AT: 'Österrike', CH: 'Schweiz', IE: 'Irland', PT: 'Portugal',
};
export const countryName = (iso: string) => COUNTRY_NAMES[iso] ?? iso;

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
    if (!prev) map.set(k, { ...d });
    else map.set(k, { ...prev, is_work: prev.is_work || d.is_work, is_presence: prev.is_presence || d.is_presence, conflict: prev.conflict || d.conflict });
  }
  return [...map.values()];
}

export interface Counter { work: number; presence: number; first: string | null; last: string | null; verification: Verification; conflicts: number; projectIds: string[] }

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
    first, last, conflicts,
    verification: d.length ? VER_ORDER[worst] : 'INSUFFICIENT_DATA',
    projectIds: [...pids],
  };
}

/** Longest run of consecutive presence days ending inside [from,to]. */
export function longestContinuous(days: ForeignDay[]): number {
  const sorted = [...new Set(dedupeDays(days).filter(d => d.is_presence).map(d => d.day))].sort();
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
    case 'CALENDAR_YEAR': return { from: `${asOf.slice(0, 4)}-01-01`, to: `${asOf.slice(0, 4)}-12-31` };
    case 'ROLLING_12_MONTHS': {
      const y = +asOf.slice(0, 4) - 1;
      let from = `${y}${asOf.slice(4)}`;
      if (from.endsWith('-02-29')) from = `${y}-03-01`; else from = addDays(from, 1);
      return { from, to: asOf };
    }
    case 'FIXED_DATE_RANGE': return rule.window_start && rule.window_end ? { from: rule.window_start, to: rule.window_end } : null;
    case 'CONTINUOUS_ASSIGNMENT': return { from: addDays(asOf, -1095), to: asOf };
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
  const value = rule.metric === 'WORK_DAYS' ? countDays(inWin).work
    : rule.metric === 'PRESENCE_DAYS' ? countDays(inWin).presence
    : longestContinuous(inWin);
  const nt = nextThreshold(value, rule);
  return { rule, country, window, value, status: statusFor(value, rule), nextThreshold: nt, remaining: nt == null ? null : nt - value, dayCount: inWin.length };
}

export function worstStatus(flags: (Flag | null)[]): FlagStatus {
  return flags.reduce<FlagStatus>((w, f) => (f && STATUS_RANK[f.status] > STATUS_RANK[w] ? f.status : w), 'NORMAL');
}

/** Projected impact of a booking: adds only days not already counted. Missing dates -> NOT_VERIFIED. */
export function projectBooking(rule: ForeignRule, country: string, days: ForeignDay[], asOf: string,
  booking: { installer_id: string; start?: string | null; end?: string | null }) {
  const current = evaluateRule(rule, country, days, asOf);
  if (!current) return null;
  if (!booking.start || !booking.end || current.status === 'NOT_VERIFIED') return { current, added: null, projected: null, status: 'NOT_VERIFIED' as FlagStatus };
  const existing = new Set(days.filter(d => d.country === country).map(d => d.day));
  const extra: ForeignDay[] = datesInRange(booking.start, booking.end).filter(d => !existing.has(d)).map(day => ({
    installer_id: booking.installer_id, country, day, is_work: true, is_presence: true, work_source: 'booking', presence_source: 'booking', verification: 'DERIVED', project_ids: [], conflict: false,
  }));
  const evalAt = booking.end > asOf ? booking.end : asOf;
  const projected = evaluateRule(rule, country, [...days, ...extra], evalAt);
  return { current, added: projected && current.value != null && projected.value != null ? projected.value - current.value : extra.length, projected: projected?.value ?? null, status: projected?.status ?? 'NOT_VERIFIED' };
}

export function docStatus(doc: { status: DocStatus; valid_from: string | null; valid_to: string | null } | null, asOf: string, expiringDays = 30): DocStatus {
  if (!doc) return 'MISSING';
  if (doc.status === 'NOT_REQUIRED') return 'NOT_REQUIRED';
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
    const inPeriod = mine.filter(d => d.country === country && d.day >= period.from && d.day <= period.to);
    const flags = rules.map(r => evaluateRule(r, country, mine, asOf, homeConfigured)).filter(Boolean) as Flag[];
    const next = flags.filter(f => f.remaining != null).sort((a, b) => a.remaining! - b.remaining!)[0] ?? null;
    let status = worstStatus(flags);
    if (!homeConfigured) status = 'NOT_VERIFIED';
    return { country, counter: countDays(inPeriod), flags, status, next };
  }).filter(s => s.counter.presence > 0 || s.flags.some(f => (f.value ?? 0) > 0));
}
