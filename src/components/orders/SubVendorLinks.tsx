import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Link2, Share2, RotateCw, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { ensureProjectRowId, loadAppData, useInstallersList } from '@/lib/appData';
import { hashToken, linkExpiry, linkStatus, linkUrl, newToken } from '@/lib/subvendorLinks';

interface Props {
  projectRef: string;
  endDate?: string;
  status?: string;
  /** Called with the sub-vendor's installer id so the order books them. */
  onAssign: (installerId: string) => void;
}

interface Row { id: string; installer_id: string; expires_at: string | null; revoked_at: string | null; last_used_at: string | null; created_at: string }

const SubVendorLinks = ({ projectRef, endDate, status, onAssign }: Props) => {
  const installers = useInstallersList();
  const subs = installers.filter(i => i.type === 'sub-vendor');
  const [rowId, setRowId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pick, setPick] = useState('new');
  const [person, setPerson] = useState('');
  const [company, setCompany] = useState('');
  const [fresh, setFresh] = useState<{ installerId: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (id: string) => {
    const { data } = await supabase.from('work_order_links').select('id,installer_id,expires_at,revoked_at,last_used_at,created_at')
      .eq('project_id', id).order('created_at', { ascending: false });
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => { ensureProjectRowId(projectRef).then(id => { setRowId(id); if (id) reload(id); }); }, [projectRef, reload]);

  const createLink = async (installerId: string) => {
    if (!rowId) return;
    const token = newToken();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('work_order_links').insert({
      project_id: rowId, installer_id: installerId, token_hash: await hashToken(token), created_by: u.user?.id,
      expires_at: status === 'completed' ? new Date(Date.now() + 5 * 86400000).toISOString() : null,
    });
    if (error) throw error;
    setFresh({ installerId, url: linkUrl(token) });
    await reload(rowId);
  };

  const add = async () => {
    setBusy(true);
    try {
      let id = pick;
      if (pick === 'new') {
        if (!person.trim() || !company.trim()) { toast.error('Enter name and company'); return; }
        const { data, error } = await supabase.from('installers').insert({
          name: `${person.trim()} (${company.trim()})`, type: 'sub-vendor', color: Math.floor(Math.random() * 360),
        }).select('id').single();
        if (error) throw error;
        id = data.id;
        await loadAppData();
      }
      onAssign(id);
      await createLink(id);
      setPerson(''); setCompany(''); setPick('new');
      toast.success('Link created — remember to Save changes so the booking is kept');
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const revoke = async (r: Row) => {
    await supabase.from('work_order_links').update({ revoked_at: new Date().toISOString() }).eq('id', r.id);
    if (rowId) reload(rowId);
  };
  const renew = async (r: Row) => {
    await revoke(r);
    try { await createLink(r.installer_id); } catch (e) { toast.error((e as Error).message); }
  };

  const copy = (url: string) => navigator.clipboard.writeText(url).then(() => toast.success('Link copied'));
  const share = (url: string) => navigator.share ? navigator.share({ title: 'FETCH work order', url }).catch(() => {}) : copy(url);
  const nameOf = (id: string) => installers.find(i => i.id === id)?.name ?? 'Sub-vendor';

  return (
    <div className="col-span-2 space-y-2 rounded-md border border-border p-3">
      <Label className="flex items-center gap-1.5"><Link2 className="h-4 w-4" /> Sub-vendor via link</Label>
      <p className="text-xs text-muted-foreground">The link opens only this work order — site details only, no prices or client info. It stops working 5 days after the order is completed or after its end date.</p>
      {!rowId ? <p className="text-xs text-muted-foreground">Save the work order first.</p> : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Select value={pick} onValueChange={setPick}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ New sub-vendor</SelectItem>
                  {subs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {pick === 'new' && (<>
              <Input placeholder="Person name" value={person} onChange={e => setPerson(e.target.value)} />
              <Input placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />
            </>)}
          </div>
          <Button type="button" size="sm" onClick={add} disabled={busy}>Add sub-vendor & create link</Button>

          {fresh && (
            <div className="rounded-md bg-primary/10 p-2 space-y-1.5">
              <p className="text-xs font-semibold">Link for {nameOf(fresh.installerId)} (shown once — copy it now)</p>
              <Input readOnly value={fresh.url} onFocus={e => e.target.select()} className="h-8 text-xs" />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => copy(fresh.url)}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => share(fresh.url)}><Share2 className="h-3.5 w-3.5 mr-1" />Send</Button>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <ul className="space-y-1">
              {rows.map(r => {
                const st = linkStatus({ revokedAt: r.revoked_at, expiresAt: r.expires_at, orderEndDate: endDate, orderStatus: status });
                const exp = linkExpiry({ expiresAt: r.expires_at, orderEndDate: endDate });
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">{nameOf(r.installer_id)}</span>
                    <span className={st === 'active' ? 'text-primary font-semibold' : 'text-muted-foreground'}>
                      {st === 'active' ? `Active${exp ? ` · expires ${exp.toLocaleDateString('sv-SE')}` : ''}` : st === 'revoked' ? 'Revoked' : 'Expired'}
                    </span>
                    {r.last_used_at && <span className="text-muted-foreground">last used {new Date(r.last_used_at).toLocaleString('sv-SE')}</span>}
                    <span className="ml-auto flex gap-1">
                      <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => renew(r)}><RotateCw className="h-3 w-3 mr-1" />New link</Button>
                      {st === 'active' && <Button type="button" size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => revoke(r)}><Ban className="h-3 w-3 mr-1" />Revoke</Button>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default SubVendorLinks;
