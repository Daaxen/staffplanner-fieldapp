import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Admin only' }, 403);

    const body = await req.json().catch(() => null) as
      | { action: 'update' | 'reset_password' | 'resend_invite' | 'delete'; user_id?: string; email?: string; full_name?: string; phone?: string }
      | null;
    if (!body?.action) return json({ error: 'action required' }, 400);

    const origin = req.headers.get('origin');
    const redirectTo = origin ? `${origin}/auth` : undefined;

    if (body.action === 'update') {
      if (!body.user_id) return json({ error: 'user_id required' }, 400);
      const email = body.email?.trim();
      if (email !== undefined && email !== '') {
        const { error } = await admin.auth.admin.updateUserById(body.user_id, { email });
        if (error) return json({ error: error.message }, 400);
      }
      const { error: pErr } = await admin
        .from('profiles')
        .update({
          full_name: body.full_name ?? null,
          phone: body.phone ?? null,
          ...(email ? { email } : {}),
        })
        .eq('id', body.user_id);
      if (pErr) return json({ error: pErr.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'reset_password') {
      if (!body.email) return json({ error: 'email required' }, 400);
      const { error } = await admin.auth.resetPasswordForEmail(body.email, { redirectTo });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'resend_invite') {
      if (!body.email) return json({ error: 'email required' }, 400);
      const { error } = await admin.auth.admin.inviteUserByEmail(body.email, { redirectTo });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'delete') {
      if (!body.user_id) return json({ error: 'user_id required' }, 400);
      if (body.user_id === userData.user.id) return json({ error: 'You cannot delete your own account' }, 400);
      const { error } = await admin.auth.admin.deleteUser(body.user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
