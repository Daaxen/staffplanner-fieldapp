// Shared authorization for privileged, scheduled jobs.
//
// A request is trusted only when it proves one of the following:
//  1. it carries the dedicated server-side job secret (x-cron-secret), or
//  2. it comes from a signed-in user who holds the admin role.
//
// The public anon key is NEVER accepted as proof of trust.

import { createClient } from 'npm:@supabase/supabase-js@2';

const encoder = new TextEncoder();

/** Constant-time string comparison (no early exit on first mismatch). */
export function secretsMatch(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  // Compare fixed-size digests so length never leaks through timing.
  if (ab.length !== bb.length) {
    let diff = 1;
    const n = Math.max(ab.length, bb.length);
    for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
    return diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export type JobAuth =
  | { ok: true; via: 'cron-secret' | 'admin'; userId?: string }
  | { ok: false; status: number; error: string };

export async function authorizeJobRequest(req: Request, secretName: string): Promise<JobAuth> {
  const expected = Deno.env.get(secretName);
  const provided = req.headers.get('x-cron-secret');

  if (provided) {
    if (!expected) return { ok: false, status: 503, error: 'Job secret is not configured' };
    if (!secretsMatch(provided, expected)) return { ok: false, status: 401, error: 'Unauthorized' };
    return { ok: true, via: 'cron-secret' };
  }

  // Fall back to a verified admin JWT (manual "run now" from the backoffice).
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' };

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // The anon key alone proves nothing — the token must resolve to a real user.
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return { ok: false, status: 401, error: 'Unauthorized' };

  const admin = createClient(url, service);
  const { data: isAdmin } = await admin.rpc('has_role', {
    _user_id: userData.user.id,
    _role: 'admin',
  });
  if (!isAdmin) return { ok: false, status: 403, error: 'Admin role required' };

  return { ok: true, via: 'admin', userId: userData.user.id };
}
