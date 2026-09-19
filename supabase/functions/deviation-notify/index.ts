import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Notifies administrators as soon as a field deviation is reported.
const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

async function sendFcm(tokens: string[], title: string, body: string, data: Record<string, string>) {
  const key = Deno.env.get('FCM_SERVER_KEY');
  if (!key || tokens.length === 0) return { skipped: true, count: 0 };
  const res = await fetch(FCM_URL, {
    method: 'POST',
    headers: { Authorization: `key=${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ registration_ids: tokens, notification: { title, body }, data }),
  });
  return { skipped: false, count: tokens.length, status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { deviation_id } = await req.json();
    if (!deviation_id) {
      return new Response(JSON.stringify({ error: 'deviation_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: dev, error } = await supabase
      .from('deviations')
      .select(
        'id, project_id, project_ref, category, severity, description, installer_name, projects(name)',
      )
      .eq('id', deviation_id)
      .single();
    if (error || !dev) throw error ?? new Error('deviation not found');

    const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
    const adminIds = (admins ?? []).map(a => a.user_id);
    let tokens: string[] = [];
    if (adminIds.length) {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('fcm_token')
        .in('user_id', adminIds);
      tokens = (subs ?? []).map(s => s.fcm_token);
    }

    const title = `${dev.severity.toUpperCase()} deviation: ${dev.category.replace(/-/g, ' ')}`;
    // Current name comes from the order itself; project_ref is only a snapshot.
    const projectName = (dev as { projects?: { name?: string } }).projects?.name ?? dev.project_ref;
    const body = `${projectName}${dev.installer_name ? ` · ${dev.installer_name}` : ''} — ${String(dev.description).slice(0, 120)}`;
    const push = await sendFcm(tokens, title, body, {
      deviation_id: dev.id,
      project_id: dev.project_id,
      project_ref: dev.project_ref,
      severity: dev.severity,
    });

    return new Response(JSON.stringify({ ok: true, push }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('deviation-notify error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
