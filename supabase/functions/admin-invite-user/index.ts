import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized', detail: userErr?.message }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { email, full_name, role, roles, phone } = body as {
      email: string; full_name?: string; role?: string; roles?: string[]; phone?: string;
    };
    const allowed = ['admin', 'installer', 'hr'];
    const wanted = Array.from(new Set((roles && roles.length ? roles : role ? [role] : []).filter(r => allowed.includes(r))));
    if (!email || wanted.length === 0) {
      return new Response(JSON.stringify({ error: 'email and at least one role required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const redirectTo = req.headers.get('origin') ? `${req.headers.get('origin')}/auth` : undefined;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name, phone },
      redirectTo,
    });
    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // handle_new_user trigger assigns a default role; replace it with exactly the requested set
    if (invited.user) {
      await admin.from('user_roles').upsert(
        wanted.map(r => ({ user_id: invited.user!.id, role: r })),
        { onConflict: 'user_id,role' },
      );
      await admin.from('user_roles').delete().eq('user_id', invited.user.id).not('role', 'in', `(${wanted.join(',')})`);
    }

    return new Response(JSON.stringify({ user: invited.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
