import { describe, it, expect } from 'vitest';
import { linkStatus, linkExpiry } from '@/lib/subvendorLinks';

describe('sub-vendor link expiry', () => {
  it('stays active until order end date + 5 days', () => {
    const s = { orderEndDate: '2026-11-10' };
    expect(linkStatus(s, new Date('2026-11-15T12:00:00Z'))).toBe('active');
    expect(linkStatus(s, new Date('2026-11-16T00:00:00Z'))).toBe('expired');
  });
  it('expires 5 days after completion when that is earlier', () => {
    const s = { orderEndDate: '2026-12-31', expiresAt: '2026-11-16T10:00:00Z' };
    expect(linkExpiry(s)?.toISOString()).toBe('2026-11-16T10:00:00.000Z');
    expect(linkStatus(s, new Date('2026-11-16T11:00:00Z'))).toBe('expired');
  });
  it('a revoked link never works', () => {
    expect(linkStatus({ revokedAt: '2026-11-01T00:00:00Z', orderEndDate: '2027-01-01' }, new Date('2026-11-02'))).toBe('revoked');
  });
});
