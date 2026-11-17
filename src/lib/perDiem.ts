/**
 * Swedish tax-free per diem (traktamente), Skatteverket rules.
 * Mirrors public.compute_per_diem_entry() so the app can show the amount
 * before saving; the database always recomputes the stored amount.
 */
export const DOMESTIC = 'Sverige';
export type DayType = 'full' | 'half' | 'none';
export type Overnight = 'hotel' | 'private' | 'none';
export type Meals = { breakfast: boolean; lunch: boolean; dinner: boolean };

export function mealReduction(meals: Meals, domestic: boolean): number {
  const n = Number(meals.breakfast) + Number(meals.lunch) + Number(meals.dinner);
  if (n === 3) return domestic ? 0.9 : 0.85;
  return (meals.breakfast ? (domestic ? 0.2 : 0.15) : 0) + (meals.lunch ? 0.35 : 0) + (meals.dinner ? 0.35 : 0);
}

export function perDiemAmount(input: { fullDayRate: number; country: string; dayType: DayType; overnight: Overnight; meals: Meals }) {
  const domestic = input.country === DOMESTIC;
  const red = mealReduction(input.meals, domestic);
  const base = input.dayType === 'full' ? input.fullDayRate : input.dayType === 'half' ? input.fullDayRate * 0.5 : 0;
  const day = Math.round(base * (1 - red));
  const night = input.overnight === 'private' ? Math.round(input.fullDayRate * 0.5) : 0;
  return { day, night, total: day + night, reductionPct: Math.round(red * 100) };
}

/** Full day if departing before 12:00 / returning after 19:00 (Skatteverket). */
export function dayTypeFromTimes(kind: 'departure' | 'return' | 'between', time?: string): DayType {
  if (kind === 'between' || !time) return 'full';
  const [h, m] = time.split(':').map(Number);
  const mins = h * 60 + (m || 0);
  return kind === 'departure' ? (mins < 12 * 60 ? 'full' : 'half') : (mins > 19 * 60 ? 'full' : 'half');
}

/** Names Skatteverket (per_diem_rates) spells differently from Intl's Swedish names. */
const COUNTRY_OVERRIDES: Record<string, string> = { GB: 'Storbritannien och Nordirland' };

/** Map a Google/ISO two-letter country code (e.g. "FI") to the Swedish country name used in per_diem_rates. */
export function countryFromCode(code?: string | null): string | null {
  const iso = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) return null;
  if (COUNTRY_OVERRIDES[iso]) return COUNTRY_OVERRIDES[iso];
  try {
    const name = new Intl.DisplayNames(['sv'], { type: 'region' }).of(iso);
    return name && name !== iso ? name : null;
  } catch {
    return null;
  }
}
