import { describe, it, expect } from 'vitest';
import { countryFromCode } from '@/lib/perDiem';
describe('countryFromCode', () => {
  it('FI → Finland', () => expect(countryFromCode('FI')).toBe('Finland'));
  it('SE → Sverige', () => expect(countryFromCode('se')).toBe('Sverige'));
  it('NO → Norge', () => expect(countryFromCode('NO')).toBe('Norge'));
  it('GB uses Skatteverket name', () => expect(countryFromCode('GB')).toBe('Storbritannien och Nordirland'));
  it('unknown → null', () => { expect(countryFromCode('')).toBeNull(); expect(countryFromCode('XYZ')).toBeNull(); });
});
