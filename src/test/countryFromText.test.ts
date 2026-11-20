import { describe, it, expect } from 'vitest';
import { countryFromText } from '@/lib/perDiem';
describe('countryFromText', () => {
  it('reads country codes and cities', () => {
    expect(countryFromText('Scandic Oslo City SU - NO')).toBe('Norge');
    expect(countryFromText('Scandic Grand Central Helsinki SU - FI')).toBe('Finland');
    expect(countryFromText('Scandic CPH Strandpark F3')).toBe('Danmark');
    expect(countryFromText('Scandic Stuttgart F3')).toBe('Tyskland');
    expect(countryFromText('Scandic Gävle West')).toBeNull();
  });
});
