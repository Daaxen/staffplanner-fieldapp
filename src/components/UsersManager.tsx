import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, UserPlus, Shield, User as UserIcon, Copy } from 'lucide-react';

type Role = 'admin' | 'installer';

interface Row {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  roles: Role[];
}

const UsersManager = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', phone: '', role: 'installer' as Role });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from('profiles').select('id,email,full_name,phone,avatar_url').order('created_at', { ascending: false });
    const { data: roles } = await supabase.from('user_roles').select('user_id,role');
    const byUser: Record<string, Role[]> = {};
    (roles ?? []).forEach((r: { user_id: string; role: Role }) => {
      byUser[r.user_id] = [...(byUser[r.user_id] ?? []), r.role];
    });
    setRows((profiles ?? []).map((p) => ({ ...(p as unknown as Omit<Row, 'roles'>), roles: byUser[(p as { id: string }).id] ?? [] })));
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

  const toggleRole = async (userId: string, role: Role, has: boolean) => {
    if (has) {
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
    } else {
      await supabase.from('user_roles').insert({ user_id: userId, role });
    }
    load();
  };

  const remove = async (userId: string) => {
    if (!confirm('Delete this user profile? (Auth user must be removed separately.)')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  };

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
            <div key={r.id} className="flex items-center gap-4 p-4">
              <Avatar>
                <AvatarImage src={r.avatar_url ?? undefined} />
                <AvatarFallback>{(r.full_name || r.email || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.full_name || '(no name)'}</p>
                <p className="text-xs text-muted-foreground truncate">{r.email} {r.phone && `· ${r.phone}`}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={r.roles.includes('admin') ? 'default' : 'outline'} onClick={() => toggleRole(r.id, 'admin', r.roles.includes('admin'))}>
                  <Shield className="w-3 h-3 mr-1" />Admin
                </Button>
                <Button size="sm" variant={r.roles.includes('installer') ? 'default' : 'outline'} onClick={() => toggleRole(r.id, 'installer', r.roles.includes('installer'))}>
                  <UserIcon className="w-3 h-3 mr-1" />Installer
                </Button>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">No users yet. Invite one to get started.</p>}
        </div>
      )}
    </div>
  );
};

export default UsersManager;
