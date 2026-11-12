import { describe, it, expect } from 'vitest';
import { perDiemAmount, dayTypeFromTimes } from '@/lib/perDiem';
const none = { breakfast: false, lunch: false, dinner: false };

describe('traktamente (Skatteverket 2026)', () => {
  it('inrikes heldag 300 kr', () => expect(perDiemAmount({ fullDayRate: 300, country: 'Sverige', dayType: 'full', overnight: 'hotel', meals: none }).total).toBe(300));
  it('inrikes halvdag 150 kr', () => expect(perDiemAmount({ fullDayRate: 300, country: 'Sverige', dayType: 'half', overnight: 'hotel', meals: none }).total).toBe(150));
  it('inrikes lunch bjuden: 300 − 105 = 195 kr', () => expect(perDiemAmount({ fullDayRate: 300, country: 'Sverige', dayType: 'full', overnight: 'hotel', meals: { ...none, lunch: true } }).total).toBe(195));
  it('inrikes alla måltider bjudna: 30 kr kvar', () => expect(perDiemAmount({ fullDayRate: 300, country: 'Sverige', dayType: 'full', overnight: 'hotel', meals: { breakfast: true, lunch: true, dinner: true } }).total).toBe(30));
  it('inrikes privat logi ger nattraktamente 150 kr', () => expect(perDiemAmount({ fullDayRate: 300, country: 'Sverige', dayType: 'full', overnight: 'private', meals: none }).total).toBe(450));
  it('utrikes frukost bjuden 15 % (Norge 1054)', () => expect(perDiemAmount({ fullDayRate: 1054, country: 'Norge', dayType: 'full', overnight: 'hotel', meals: { ...none, breakfast: true } }).total).toBe(896));
  it('utrikes alla måltider 85 %', () => expect(perDiemAmount({ fullDayRate: 1000, country: 'Norge', dayType: 'full', overnight: 'hotel', meals: { breakfast: true, lunch: true, dinner: true } }).total).toBe(150));
  it('avresa före 12 = heldag, efter = halvdag', () => { expect(dayTypeFromTimes('departure', '11:45')).toBe('full'); expect(dayTypeFromTimes('departure', '12:00')).toBe('half'); });
  it('hemkomst efter 19 = heldag, 19:00 = halvdag', () => { expect(dayTypeFromTimes('return', '19:15')).toBe('full'); expect(dayTypeFromTimes('return', '19:00')).toBe('half'); });
});
