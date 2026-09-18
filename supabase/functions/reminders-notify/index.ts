import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authorizeJobRequest } from '../_shared/jobAuth.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Sends push notifications for a reminder and logs reminder_events.
// If FCM_SERVER_KEY is not configured, still logs banner + admin_alert events
// so the in-app UI works; push events are skipped with a log line.

const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

async function sendFcm(tokens: string[], title: string, body: string, data: Record<string, string>) {
  const key = Deno.env.get('FCM_SERVER_KEY');
  if (!key || tokens.length === 0) return { skipped: true, count: 0 };
  const res = await fetch(FCM_URL, {
    method: 'POST',
    headers: { Authorization: `key=${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: { title, body },
      data,
    }),
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
    const { reminder_id, level } = await req.json();
    if (!reminder_id) return new Response(JSON.stringify({ error: 'reminder_id required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const { data: reminder, error } = await supabase
      .from('reminders')
      .select('id, project_id, installer_id, level')
      .eq('id', reminder_id)
      .single();
    if (error || !reminder) throw error ?? new Error('reminder not found');

    const lvl = level ?? reminder.level;
    const title =
      lvl === 'escalated' ? 'Overdue report escalated'
      : lvl === 'urgent' ? 'Report still missing — please close out'
      : 'Reminder: close order & log time';
    const body = `Project ${reminder.project_id} needs completion + time/mileage/cost logged.`;

    // Installer push
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('fcm_token')
      .eq('user_id', reminder.installer_id);
    const tokens = (subs ?? []).map(s => s.fcm_token);
    const push = await sendFcm(tokens, title, body, { reminder_id, project_id: reminder.project_id, level: lvl });

    await supabase.from('reminder_events').insert([
      { reminder_id, kind: 'push', channel: push.skipped ? 'skipped:no-fcm' : 'fcm', meta: push },
      { reminder_id, kind: 'banner', channel: 'in-app' },
    ]);

    // Admin escalation
    if (lvl === 'escalated') {
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');
      const adminIds = (admins ?? []).map(a => a.user_id);
      let adminTokens: string[] = [];
      if (adminIds.length) {
        const { data: aSubs } = await supabase
          .from('push_subscriptions')
          .select('fcm_token')
          .in('user_id', adminIds);
        adminTokens = (aSubs ?? []).map(s => s.fcm_token);
      }
      const adminPush = await sendFcm(
        adminTokens,
        'Installer report overdue',
        `${reminder.project_id} has not been closed/reported by assigned installer.`,
        { reminder_id, project_id: reminder.project_id, level: 'escalated' },
      );
      await supabase.from('reminder_events').insert({
        reminder_id, kind: 'admin_alert', channel: adminPush.skipped ? 'skipped:no-fcm' : 'fcm', meta: adminPush,
      });
    }

    await supabase.from('reminders').update({ last_notified_at: new Date().toISOString() }).eq('id', reminder_id);

    return new Response(JSON.stringify({ ok: true, push }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('reminders-notify error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
