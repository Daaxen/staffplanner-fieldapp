import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, UserPlus, Shield, User as UserIcon, Copy, Pencil, KeyRound, Mail, ChevronDown, ChevronRight, Lock, BriefcaseMedical } from 'lucide-react';
import {
  EmployeePrivate, emptyEmployeePrivate,
  loadEmployeePrivate, saveEmployeePrivate, useHrAccess,
} from '@/lib/employeePrivate';

type Role = 'admin' | 'installer' | 'hr';

interface Row {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  job_title: string | null;
  employment_type: string | null;
  roles: Role[];
  pending?: boolean;
}

const EDITABLE = [
  'full_name', 'phone', 'address', 'postal_code', 'city', 'country',
  'job_title', 'employment_type',
] as const;

type EditForm = Record<(typeof EDITABLE)[number], string> & { email: string };

const emptyForm = (): EditForm =>
  ({ email: '', ...Object.fromEntries(EDITABLE.map(f => [f, ''])) } as EditForm);

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('admin-manage-user', { body });
  const err = (data as { error?: string } | null)?.error || error?.message;
  return err ? { error: err } : { ok: true as const };
};

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm">{value || '—'}</p>
  </div>
);

const UsersManager = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', role: 'installer' as Role });
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm());
  const [expanded, setExpanded] = useState<string | null>(null);
  const { isHr } = useHrAccess();
  const [priv, setPriv] = useState<EmployeePrivate>(emptyEmployeePrivate());
  const [privOpen, setPrivOpen] = useState(false);
  const [privBusy, setPrivBusy] = useState(false);
  const [privReason, setPrivReason] = useState('');
  const setPrivate = (k: keyof EmployeePrivate, v: string) =>
    setPriv(prev => ({ ...prev, [k]: v === '' ? null : v }));

  const revealPrivate = async (r: Row) => {
    setPrivBusy(true);
    const { data, error } = await loadEmployeePrivate(r.id, privReason || 'Personnel administration');
    setPrivBusy(false);
    if (error) return toast.error(error);
    setPriv(data ?? emptyEmployeePrivate());
    setPrivOpen(true);
  };

  const savePrivate = async () => {
    if (!edit) return;
    setPrivBusy(true);
    const { error } = await saveEmployeePrivate(edit.id, priv, privReason || 'Personnel administration');
    setPrivBusy(false);
    if (error) return toast.error(error);
    toast.success('Confidential details saved');
  };

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    const { data: roles } = await supabase.from('user_roles').select('user_id,role');
    const byUser: Record<string, Role[]> = {};
    (roles ?? []).forEach((r: { user_id: string; role: Role }) => {
      byUser[r.user_id] = [...(byUser[r.user_id] ?? []), r.role];
    });
    const { data: statusData } = await supabase.functions.invoke('admin-manage-user', { body: { action: 'auth_status' } });
    const pendingById: Record<string, boolean> = {};
    ((statusData as { users?: { id: string; last_sign_in_at: string | null }[] } | null)?.users ?? []).forEach((u) => {
      pendingById[u.id] = !u.last_sign_in_at;
    });
    setRows((profiles ?? []).map((p) => {
      const id = (p as { id: string }).id;
      return { ...(p as unknown as Omit<Row, 'roles'>), roles: byUser[id] ?? [], pending: pendingById[id] ?? false };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const invite = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('admin-invite-user', { body: form });
    setBusy(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast.error((data as { error?: string })?.error || error?.message || 'Invite failed');
      return;
    }
    toast.success(`Invitation sent to ${form.email}`);
    setOpen(false);
    setForm({ email: '', full_name: '', phone: '', role: 'installer' });
    load();
  };

  const openEdit = (r: Row) => {
    setEdit(r);
    const f = emptyForm();
    f.email = r.email ?? '';
    EDITABLE.forEach(k => { f[k] = (r[k] as string | null) ?? ''; });
    setEditForm(f);
  };

  const saveEdit = async () => {
    if (!edit) return;
    setBusy(true);
    if (editForm.email && editForm.email !== (edit.email ?? '')) {
      const res = await call({ action: 'update', user_id: edit.id, email: editForm.email });
      if ('error' in res) { setBusy(false); return toast.error(res.error); }
    }
    const payload: Record<string, string | null> = {};
    EDITABLE.forEach(k => { payload[k] = editForm[k] === '' ? null : editForm[k]; });
    if (editForm.email) payload.email = editForm.email;
    const { error } = await supabase.from('profiles').update(payload).eq('id', edit.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('User updated');
    setEdit(null);
    load();
  };

  const sendReset = async (r: Row) => {
    if (!r.email) return toast.error('User has no email');
    const res = await call({ action: 'reset_password', email: r.email });
    if ('error' in res) toast.error(res.error); else toast.success(`Password reset link sent to ${r.email}`);
  };

  const resendInvite = async (r: Row) => {
    if (!r.email) return toast.error('User has no email');
    const res = await call({ action: 'resend_invite', email: r.email });
    if ('error' in res) toast.error(res.error); else toast.success(`Invite resent to ${r.email}`);
  };

  const toggleRole = async (userId: string, role: Role, has: boolean) => {
    const { error } = await supabase.rpc('admin_set_user_role', {
      _user_id: userId,
      _role: role,
      _grant: !has,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (userId: string) => {
    if (!confirm('Permanently delete this user, their login and profile?')) return;
    const res = await call({ action: 'delete', user_id: userId });
    if ('error' in res) toast.error(res.error); else { toast.success('User deleted'); load(); }
  };

  const set = (k: keyof EditForm, v: string) => setEditForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4 mr-2" />Invite user</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite new user</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Full name</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v: Role) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="installer">Installer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={invite} disabled={busy || !form.email}>{busy ? 'Sending…' : 'Send invite'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {rows.map(r => (
            <div key={r.id}>
              <div className="flex items-center gap-4 p-4">
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  {expanded === r.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </Button>
                <Avatar>
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback>{(r.full_name || r.email || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {r.full_name || '(no name)'}
                    {r.job_title && <span className="text-xs text-muted-foreground font-normal"> · {r.job_title}</span>}
                    {r.pending && (
                      <span className="ml-2 align-middle text-[10px] font-medium uppercase tracking-wide rounded px-1.5 py-0.5 bg-status-on-hold/15 text-status-on-hold">
                        Pending invite
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{r.email} {r.phone && `· ${r.phone}`} {r.city && `· ${r.city}`}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[280px]" title={r.id}>{r.id}</code>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { navigator.clipboard.writeText(r.id); toast.success('User ID copied'); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant={r.roles.includes('admin') ? 'default' : 'outline'} onClick={() => toggleRole(r.id, 'admin', r.roles.includes('admin'))}>
                    <Shield className="w-3 h-3 mr-1" />Admin
                  </Button>
                  <Button size="sm" variant={r.roles.includes('installer') ? 'default' : 'outline'} onClick={() => toggleRole(r.id, 'installer', r.roles.includes('installer'))}>
                    <UserIcon className="w-3 h-3 mr-1" />Installer
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" title="Edit user" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" title="Send password reset" onClick={() => sendReset(r)}><KeyRound className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" title="Resend invite" onClick={() => resendInvite(r)}><Mail className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" title="Delete user" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              {expanded === r.id && (
                <div className="px-6 pb-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30">
                  <Field label="Home address" value={[r.address, r.postal_code, r.city, r.country].filter(Boolean).join(', ')} />
                  <Field label="Job title" value={r.job_title} />
                  <Field label="Employment type" value={r.employment_type} />
                  <Field label="Roles" value={r.roles.join(', ')} />
                  <p className="col-span-2 md:col-span-4 text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Date of birth, emergency contacts, medical notes, sizes and employment dates are confidential and only available to HR.
                  </p>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">No users yet. Invite one to get started.</p>}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => set('email', e.target.value)} /></div>
              <div className="space-y-1"><Label>Full name</Label><Input value={editForm.full_name} onChange={e => set('full_name', e.target.value)} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={editForm.phone} onChange={e => set('phone', e.target.value)} /></div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Home address</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2"><Label>Street address</Label><Textarea value={editForm.address} onChange={e => set('address', e.target.value)} /></div>
                <div className="space-y-1"><Label>Postal code</Label><Input value={editForm.postal_code} onChange={e => set('postal_code', e.target.value)} /></div>
                <div className="space-y-1"><Label>City</Label><Input value={editForm.city} onChange={e => set('city', e.target.value)} /></div>
                <div className="space-y-1"><Label>Country</Label><Input value={editForm.country} onChange={e => set('country', e.target.value)} /></div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Work</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Job title</Label><Input value={editForm.job_title} onChange={e => set('job_title', e.target.value)} /></div>
                <div className="space-y-1">
                  <Label>Employment type</Label>
                  <Select value={editForm.employment_type || 'none'} onValueChange={v => set('employment_type', v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Not set —</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="sub_vendor">Sub-vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4" /> Confidential personal details
              </p>
              {!isHr ? (
                <p className="text-xs text-muted-foreground">
                  Date of birth, emergency contacts, medical notes, sizes and employment dates are stored separately and
                  can only be opened by someone with the HR role. Every access is logged.
                </p>
              ) : !privOpen ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Opening these details is recorded in the access log.</p>
                  <Input placeholder="Reason for access (optional)" value={privReason} onChange={e => setPrivReason(e.target.value)} />
                  <Button variant="outline" size="sm" disabled={privBusy} onClick={() => edit && revealPrivate(edit)}>
                    <BriefcaseMedical className="w-4 h-4 mr-2" />{privBusy ? 'Opening…' : 'Show confidential details'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Date of birth</Label><Input type="date" value={priv.date_of_birth ?? ''} onChange={e => setPrivate('date_of_birth', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Driver's licence</Label><Input value={priv.drivers_license ?? ''} onChange={e => setPrivate('drivers_license', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Employment start date</Label><Input type="date" value={priv.employment_start_date ?? ''} onChange={e => setPrivate('employment_start_date', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Employment end date</Label><Input type="date" value={priv.employment_end_date ?? ''} onChange={e => setPrivate('employment_end_date', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Emergency contact name</Label><Input value={priv.emergency_contact_name ?? ''} onChange={e => setPrivate('emergency_contact_name', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Emergency contact phone</Label><Input value={priv.emergency_contact_phone ?? ''} onChange={e => setPrivate('emergency_contact_phone', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Relation</Label><Input value={priv.emergency_contact_relation ?? ''} onChange={e => setPrivate('emergency_contact_relation', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Medical notes / allergies</Label><Input value={priv.medical_notes ?? ''} onChange={e => setPrivate('medical_notes', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Second contact name</Label><Input value={priv.emergency_contact2_name ?? ''} onChange={e => setPrivate('emergency_contact2_name', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Second contact phone</Label><Input value={priv.emergency_contact2_phone ?? ''} onChange={e => setPrivate('emergency_contact2_phone', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Clothing size</Label><Input value={priv.clothing_size ?? ''} onChange={e => setPrivate('clothing_size', e.target.value)} /></div>
                    <div className="space-y-1"><Label>Shoe size</Label><Input value={priv.shoe_size ?? ''} onChange={e => setPrivate('shoe_size', e.target.value)} /></div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Kept while employed and for 24 months after the employment end date, then deleted automatically.
                  </p>
                  <Button size="sm" onClick={savePrivate} disabled={privBusy}>
                    {privBusy ? 'Saving…' : 'Save confidential details'}
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => edit && sendReset(edit)}><KeyRound className="w-4 h-4 mr-2" />Send password reset</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersManager;
