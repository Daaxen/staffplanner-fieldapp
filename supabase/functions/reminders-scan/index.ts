import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Scans projects past their end date and creates/updates reminders for
// installers who haven't completed the order + logged time + logged expense.
// Escalation ladder from T0 (end_date + 1 day 08:00 local, treated as UTC here):
//   T+0h  gentle
//   T+4h  urgent
//   T+8h  escalated (admin alert)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Pull candidate projects: end_date < today and not completed/cancelled.
    const { data: projects, error: pErr } = await supabase
      .from('projects')
      .select('id, end_date, status, project_assignees(user_id)')
      .lt('end_date', today)
      .not('status', 'in', '(completed,cancelled)');

    if (pErr) throw pErr;

    const created: string[] = [];
    const bumped: string[] = [];

    for (const p of projects ?? []) {
      const assignees: string[] = (p.project_assignees ?? []).map((a: { user_id: string }) => a.user_id);
      if (assignees.length === 0) continue;

      // T0 = end_date + 1 day at 08:00 UTC (simple, no per-tz handling yet)
      const t0 = new Date(`${p.end_date}T08:00:00Z`);
      t0.setUTCDate(t0.getUTCDate() + 1);
      if (now < t0) continue;

      const hoursSinceT0 = (now.getTime() - t0.getTime()) / 3_600_000;
      const targetLevel: 'gentle' | 'urgent' | 'escalated' =
        hoursSinceT0 >= 8 ? 'escalated' : hoursSinceT0 >= 4 ? 'urgent' : 'gentle';

      for (const installerId of assignees) {
        // Reminder rows are keyed on (project_id, installer_id).
        // Time/expense logs currently live in localStorage on the installer's
        // device, so this scanner conservatively assumes "missing" until the
        // installer explicitly resolves the reminder from the app.
        const missing = {
          completion: p.status !== 'completed',
          time: true,
          expense: true,
        };

        const { data: existing } = await supabase
          .from('reminders')
          .select('id, level, status')
          .eq('project_id', p.id)
          .eq('installer_id', installerId)
          .maybeSingle();

        if (!existing) {
          const { data: ins, error } = await supabase
            .from('reminders')
            .insert({
              project_id: p.id,
              installer_id: installerId,
              triggered_at: t0.toISOString(),
              level: targetLevel,
              status: 'open',
              missing,
            })
            .select('id')
            .single();
          if (error) { console.error('insert reminder', error); continue; }
          created.push(ins.id);
          await supabase.functions.invoke('reminders-notify', {
            body: { reminder_id: ins.id, level: targetLevel },
          });
        } else if (existing.status === 'open') {
          const order = { gentle: 0, urgent: 1, escalated: 2 } as const;
          if (order[targetLevel] > order[existing.level as keyof typeof order]) {
            await supabase
              .from('reminders')
              .update({ level: targetLevel, missing })
              .eq('id', existing.id);
            bumped.push(existing.id);
            await supabase.functions.invoke('reminders-notify', {
              body: { reminder_id: existing.id, level: targetLevel },
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, created: created.length, bumped: bumped.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('reminders-scan error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
