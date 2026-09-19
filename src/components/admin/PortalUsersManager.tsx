import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClients } from '@/lib/appData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Trash2, Send } from 'lucide-react';

interface PortalUserRow {
  profile_id: string;
  client_id: string;
  created_at: string;
  profiles?: { email: string | null; full_name: string | null } | null;
  clients?: { name: string | null } | null;
}

interface LogRow {
  id: string;
  created_at: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  profile_id: string | null;
  client_id: string | null;
  metadata: unknown;
}

const PortalUsersManager = () => {
  const clients = useClients();
  const [rows, setRows] = useState<PortalUserRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [email, setEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [{ data: users }, { data: entries }] = await Promise.all([
      supabase
        .from('customer_portal_users')
        .select('profile_id,client_id,created_at,profiles(email,full_name),clients(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('customer_portal_access_log')
        .select('id,created_at,entity_type,entity_id,action,profile_id,client_id,metadata')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    setRows((users ?? []) as unknown as PortalUserRow[]);
    setLog((entries ?? []) as unknown as LogRow[]);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const invite = async () => {
    if (!email.trim() || !clientId) {
      toast.error('Enter an email address and pick a customer');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('portal-invite', {
      body: { email: email.trim(), client_id: clientId, redirect_to: `${window.location.origin}/portal` },
    });
    setBusy(false);
    const err = error?.message ?? (data as { error?: string } | null)?.error;
    if (err) {
      toast.error(err);
      return;
    }
    toast.success((data as { invited?: boolean })?.invited ? 'Invitation sent' : 'Existing account linked');
    setEmail('');
    reload();
  };

  const revoke = async (profileId: string) => {
    const { error } = await supabase.from('customer_portal_users').delete().eq('profile_id', profileId);
    if (error) toast.error(error.message);
    else {
      toast.success('Portal access removed');
      reload();
    }
  };

  const emailOf = (profileId: string | null) =>
    rows.find(r => r.profile_id === profileId)?.profiles?.email ?? profileId?.slice(0, 8) ?? '—';

  return (
    <div className="flex-1 space-y-4 overflow-auto p-6">
      <div>
        <h1 className="text-xl font-semibold">Customer portal</h1>
        <p className="text-sm text-muted-foreground">
          Invite customer contacts to a read-only view of their own projects. Every view is logged.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Portal users</TabsTrigger>
          <TabsTrigger value="activity">Activity log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Invite a customer contact</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Label htmlFor="portal-email">Email</Label>
                <Input
                  id="portal-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contact@customer.se"
                />
              </div>
              <div className="min-w-56 flex-1">
                <Label>Customer</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {clients
                      .filter(c => c.rowId)
                      .map(c => (
                        <SelectItem key={c.rowId as string} value={c.rowId as string}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={invite} disabled={busy}>
                <Send className="mr-1 h-4 w-4" /> Send invitation
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Active portal users ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.length === 0 && <p className="text-sm text-muted-foreground">No customers invited yet.</p>}
              {rows.map(r => (
                <div key={r.profile_id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{r.profiles?.email ?? r.profile_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.clients?.name ?? 'Unknown customer'} · invited {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Read only</Badge>
                    <Button variant="ghost" size="sm" onClick={() => revoke(r.profile_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Latest customer activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {log.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
              {log.map(e => (
                <div key={e.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                  <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  <span className="flex-1">{emailOf(e.profile_id)}</span>
                  <span className="capitalize">{e.action} · {e.entity_type}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PortalUsersManager;
