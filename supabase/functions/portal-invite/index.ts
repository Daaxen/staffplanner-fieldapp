import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Invites (or links) a customer contact to the read-only customer portal. Admins only. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: userData } = await caller.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'Admins only' }, 403);

  let body: { email?: string; client_id?: string; redirect_to?: string; revoke?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid body' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const clientId = body.client_id ?? '';
  if (!email || !clientId) return json({ error: 'email and client_id are required' }, 400);

  try {
    // Find an existing account for this email, otherwise send an invitation.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let account = (list?.users ?? []).find(u => (u.email ?? '').toLowerCase() === email);
    let invited = false;

    if (!account) {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: body.redirect_to,
      });
      if (invErr) return json({ error: invErr.message }, 400);
      account = inv.user;
      invited = true;
    }
    if (!account) return json({ error: 'Could not create the account' }, 400);

    // A portal account must never hold an operational role.
    await admin.from('user_roles').delete().eq('user_id', account.id);

    const { error: linkErr } = await admin
      .from('customer_portal_users')
      .upsert(
        { profile_id: account.id, client_id: clientId, invited_by: user.id },
        { onConflict: 'profile_id' },
      );
    if (linkErr) return json({ error: linkErr.message }, 400);

    await admin.from('customer_portal_access_log').insert({
      profile_id: account.id,
      client_id: clientId,
      entity_type: 'portal_account',
      entity_id: account.id,
      action: invited ? 'invited' : 'linked',
      metadata: { email, by: user.email },
    });

    return json({ ok: true, invited, profile_id: account.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
