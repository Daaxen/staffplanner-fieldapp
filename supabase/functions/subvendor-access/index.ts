import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const time = z.string().regex(/^\d{2}:\d{2}$/);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('get'), token: z.string().min(20).max(200) }),
  z.object({ action: z.literal('saveTime'), token: z.string().min(20).max(200), id: z.string().uuid().optional(),
    entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start_time: time, end_time: time,
    travel_hours: z.number().min(0).max(12), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal('deleteTime'), token: z.string().min(20).max(200), id: z.string().uuid() }),
  z.object({ action: z.literal('saveReport'), token: z.string().min(20).max(200), report_text: z.string().max(10000),
    photo_paths: z.array(z.string().max(300)).max(50), submit: z.boolean() }),
  z.object({ action: z.literal('photoUpload'), token: z.string().min(20).max(200), ext: z.enum(['jpg', 'jpeg', 'png', 'webp', 'heic']) }),
  z.object({ action: z.literal('deviation'), token: z.string().min(20).max(200), category: z.string().max(40),
    severity: z.enum(['low', 'medium', 'high', 'critical']), description: z.string().min(10).max(4000) }),
]);

/** Link-based access for a sub-vendor to exactly one work order. Only site fields are ever returned. */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid request' }, 400);
  const b = parsed.data;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: link } = await db.from('work_order_links').select('*').eq('token_hash', await sha256(b.token)).maybeSingle();
  if (!link) return json({ error: 'inactive' }, 404);
  const { data: p } = await db.from('projects').select(
    'id,name,project_number,location,street,postal_code,region,location_lat,location_lng,start_date,end_date,start_time,end_time,contact_name,contact_phone,description,status,works_weekends,client_id',
  ).eq('id', link.project_id).maybeSingle();
  if (!p) return json({ error: 'inactive' }, 404);
  const now = Date.now();
  const endLimit = p.end_date ? new Date(p.end_date + 'T23:59:59Z').getTime() + 5 * 86400000 : Infinity;
  const active = !link.revoked_at && (!link.expires_at || new Date(link.expires_at).getTime() > now) && now < endLimit
    && p.status !== 'cancelled';
  const { data: owner } = await db.from('installers').select('name').eq('id', link.installer_id).maybeSingle();
  if (!active) return json({ error: 'inactive' }, 410);
  await db.from('work_order_links').update({ last_used_at: new Date().toISOString() }).eq('id', link.id);
  const me = link.installer_id as string;
  const locked = p.status === 'completed';
  const audit = (action: string, entity: string, id: string, vals: unknown) => db.from('audit_log').insert({
    actor_type: 'service', actor_name: owner?.name ?? 'Sub-vendor', source: 'sub-vendor link', entity_type: entity,
    entity_id: id, entity_label: p.name, action, new_values: vals as never,
  });

  if (b.action === 'get') {
    const [{ data: asg }, { data: times }, { data: rep }] = await Promise.all([
      db.from('assignments').select('installer_id, installers(name,type,base_location)').eq('project_id', p.id).neq('assignment_status', 'cancelled'),
      db.from('time_entries').select('id,entry_date,start_time,end_time,hours,travel_hours,note').eq('project_id', p.id).eq('installer_id', me).order('entry_date'),
      db.from('field_reports').select('report_text,photo_paths,submitted_at').eq('project_id', p.id).eq('installer_id', me).maybeSingle(),
    ]);
    const paths = ((rep?.photo_paths ?? []) as string[]);
    const urls = paths.length ? (await db.storage.from('field-photos').createSignedUrls(paths, 3600)).data ?? [] : [];
    const { client_id: _c, ...site } = p;
    return json({
      order: site, me: { id: me, name: owner?.name }, locked, expires_at: link.expires_at,
      team: (asg ?? []).map((a: any) => ({ id: a.installer_id, name: a.installers?.name, subVendor: a.installers?.type === 'sub-vendor', company: a.installers?.type === 'sub-vendor' ? a.installers?.base_location : null })),
      times: times ?? [], report: rep ? { ...rep, photos: urls.map(u => ({ path: u.path, url: u.signedUrl })) } : null,
    });
  }

  if (b.action === 'saveTime' || b.action === 'deleteTime') {
    if (locked) return json({ error: 'TIME_LOCKED: Ordern är klar. Kontakta admin om tiden behöver ändras.' }, 409);
    if (b.action === 'deleteTime') {
      const { error } = await db.from('time_entries').delete().eq('id', b.id).eq('installer_id', me).eq('project_id', p.id);
      if (error) return json({ error: error.message }, 400);
      await audit('delete', 'time_entries', b.id, null);
      return json({ ok: true });
    }
    if ((p.start_date && b.entry_date < p.start_date) || (p.end_date && b.entry_date > p.end_date))
      return json({ error: 'Datumet ligger utanför ordern' }, 400);
    const row = { project_id: p.id, installer_id: me, client_id: p.client_id, entry_date: b.entry_date, start_time: b.start_time,
      end_time: b.end_time, hours: 0, travel_hours: b.travel_hours, note: b.note ?? null, source: 'manual' };
    const q = b.id ? db.from('time_entries').update(row).eq('id', b.id).eq('installer_id', me).eq('project_id', p.id).select('id').single()
      : db.from('time_entries').insert(row).select('id').single();
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 400);
    await audit(b.id ? 'update' : 'create', 'time_entries', data.id, row);
    return json({ ok: true });
  }

  if (b.action === 'photoUpload') {
    const path = `subvendor/${me}/${p.id}/${crypto.randomUUID()}.${b.ext}`;
    const { data, error } = await db.storage.from('field-photos').createSignedUploadUrl(path);
    if (error) return json({ error: error.message }, 400);
    return json({ path, token: data.token });
  }

  if (b.action === 'saveReport') {
    const prefix = `subvendor/${me}/${p.id}/`;
    if (b.photo_paths.some(x => !x.startsWith(prefix))) return json({ error: 'Invalid photo' }, 400);
    const row = { project_id: p.id, project_ref: p.id, installer_id: me, report_text: b.report_text, photo_paths: b.photo_paths,
      ...(b.submit ? { submitted_at: new Date().toISOString() } : {}) };
    const { error } = await db.from('field_reports').upsert(row, { onConflict: 'project_id,installer_id' });
    if (error) return json({ error: error.message }, 400);
    await audit('update', 'field_reports', p.id, { submit: b.submit });
    return json({ ok: true });
  }

  if (b.action === 'deviation') {
    const { data, error } = await db.from('deviations').insert({ project_id: p.id, project_ref: p.id, project_name: p.name,
      installer_id: me, installer_name: owner?.name, category: b.category, severity: b.severity, description: b.description,
    }).select('id').single();
    if (error) return json({ error: error.message }, 400);
    await audit('create', 'deviations', data.id, { category: b.category });
    return json({ ok: true });
  }
  return json({ error: 'Unknown action' }, 400);
});
