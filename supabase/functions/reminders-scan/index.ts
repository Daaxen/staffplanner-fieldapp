import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { authorizeJobRequest } from '../_shared/jobAuth.ts';

// Minimum time between two notifications for the same reminder.
const NOTIFY_COOLDOWN_MS = 4 * 60 * 60 * 1000;
// Runs are bucketed: only one scan per 15-minute window is ever processed.
const BUCKET_MS = 15 * 60 * 1000;
import { createClient } from 'npm:@supabase/supabase-js@2';

// Scans projects past their end date and creates/updates reminders for
// installers who haven't completed the order + logged time + logged expense.
// Escalation ladder from T0 (end_date + 1 day 08:00 local, treated as UTC here):
//   T+0h  gentle
//   T+4h  urgent
//   T+8h  escalated (admin alert)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Privileged job: only the server-side job secret or a verified admin may run it.
  const auth = await authorizeJobRequest(req, 'REMINDERS_CRON_SECRET');
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const jobSecret = Deno.env.get('REMINDERS_CRON_SECRET') ?? '';

  const notify = async (reminderId: string, level: string) => {
    await supabase.functions.invoke('reminders-notify', {
      body: { reminder_id: reminderId, level },
      headers: { 'x-cron-secret': jobSecret },
    });
  };

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Idempotency: claim this 15-minute bucket; a duplicate trigger is a no-op.
    const bucket = new Date(Math.floor(now.getTime() / BUCKET_MS) * BUCKET_MS).toISOString();
    const { error: claimErr } = await supabase
      .from('job_runs')
      .insert({ job: 'reminders-scan', bucket });
    if (claimErr) {
      return new Response(
        JSON.stringify({ ok: true, skipped: 'already ran for this window', bucket }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Pull candidate projects: end_date < today and not completed/cancelled.
    const { data: projects, error: pErr } = await supabase
      .from('projects')
      .select('id, end_date, status, project_assignees(installers(profile_id))')
      .lt('end_date', today)
      .not('status', 'in', '(completed,cancelled)');

    if (pErr) throw pErr;

    const created: string[] = [];
    const bumped: string[] = [];

    for (const p of projects ?? []) {
      // reminders.installer_id references the user account, so resolve the
      // assigned installer rows to their linked profile ids.
      const assignees: string[] = (p.project_assignees ?? [])
        .map((a: { installers?: { profile_id: string | null } | null }) => a.installers?.profile_id)
        .filter((id: string | null | undefined): id is string => !!id);
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
          .select('id, level, status, last_notified_at')
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
          await notify(ins.id, targetLevel);
        } else if (existing.status === 'open') {
          const order = { gentle: 0, urgent: 1, escalated: 2 } as const;
          if (order[targetLevel] > order[existing.level as keyof typeof order]) {
            await supabase
              .from('reminders')
              .update({ level: targetLevel, missing })
              .eq('id', existing.id);
            bumped.push(existing.id);
            // Duplicate-notification guard: never notify the same reminder
            // more often than the cooldown, even if the scan runs repeatedly.
            const last = existing.last_notified_at ? Date.parse(existing.last_notified_at) : 0;
            if (now.getTime() - last >= NOTIFY_COOLDOWN_MS) {
              await notify(existing.id, targetLevel);
            }
          }
        }
      }
    }

    await supabase
      .from('job_runs')
      .update({
        finished_at: new Date().toISOString(),
        result: { created: created.length, bumped: bumped.length, via: auth.via },
      })
      .eq('job', 'reminders-scan')
      .eq('bucket', bucket);

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
