/** Sub-vendor links: one private link gives access to exactly one work order. */
export const LINK_GRACE_DAYS = 5;

export interface LinkState { revokedAt?: string | null; expiresAt?: string | null; orderEndDate?: string | null; orderStatus?: string }

/** Last moment the link works: completion + 5 days (stored in expiresAt) or order end date + 5 days, whichever is first. */
export function linkExpiry(s: LinkState): Date | null {
  const c: number[] = [];
  if (s.expiresAt) c.push(new Date(s.expiresAt).getTime());
  if (s.orderEndDate) c.push(new Date(s.orderEndDate + 'T23:59:59Z').getTime() + LINK_GRACE_DAYS * 86400000);
  return c.length ? new Date(Math.min(...c)) : null;
}

export function linkStatus(s: LinkState, now = new Date()): 'active' | 'expired' | 'revoked' {
  if (s.revokedAt) return 'revoked';
  if (s.orderStatus === 'cancelled') return 'expired';
  const e = linkExpiry(s);
  return e && e.getTime() <= now.getTime() ? 'expired' : 'active';
}

export function newToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(t: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export const linkUrl = (token: string) => `${window.location.origin}/uv/${token}`;
