import registry from './countries.json';

export type CountryProvenance = 'CONFIRMED' | 'DERIVED' | 'DEFAULTED' | 'UNKNOWN';
const aliases = new Map(registry.flatMap(c => c.aliases.map(a => [a.trim().toLocaleLowerCase('sv'), c.code] as const)));
export const normalizeCountry = (value?: string | null): string | null => aliases.get((value ?? '').trim().toLocaleLowerCase('sv')) ?? null;
export const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(registry.map(c => [c.code, c.label]));
export const countryName = (code: string) => COUNTRY_NAMES[code] ?? 'Ej verifierat land';

/** Display names remain compatible with per diem; only canonical codes drive compliance. */
export function destinationEvidence(country?: string | null, provenance?: CountryProvenance) {
  const code = normalizeCountry(country);
  return { code, provenance: code ? (provenance ?? 'UNKNOWN') : 'UNKNOWN' as CountryProvenance };
}