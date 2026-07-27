import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { installers } from '@/data/mockData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload } from 'lucide-react';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  avatar_url: string | null;
  installer_id: string | null;
}

const ProfileEditor = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
      setProfile(data as Profile);
    });
  }, [user]);

  const save = async () => {
    if (!profile || !user) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      phone: profile.phone,
      address: profile.address,
      emergency_contact_name: profile.emergency_contact_name,
      emergency_contact_phone: profile.emergency_contact_phone,
      installer_id: profile.installer_id,
    }).eq('id', user.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success('Profile saved');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? null;
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
    setProfile({ ...profile, avatar_url: url });
    setUploading(false);
    toast.success('Avatar updated');
  };

  if (!profile) return <div className="p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">My profile</h1>

      <div className="flex items-center gap-4">
        <Avatar className="w-20 h-20">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback>{(profile.full_name || profile.email || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <label className="cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-accent">
            <Upload className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload avatar'}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={profile.email ?? ''} disabled />
        </div>
        <div className="space-y-2">
          <Label>Full name</Label>
          <Input value={profile.full_name ?? ''} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={profile.phone ?? ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Linked installer</Label>
          <Select value={profile.installer_id ?? 'none'} onValueChange={v => setProfile({ ...profile, installer_id: v === 'none' ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {installers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Address</Label>
          <Textarea value={profile.address ?? ''} onChange={e => setProfile({ ...profile, address: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Emergency contact name</Label>
          <Input value={profile.emergency_contact_name ?? ''} onChange={e => setProfile({ ...profile, emergency_contact_name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Emergency contact phone</Label>
          <Input value={profile.emergency_contact_phone ?? ''} onChange={e => setProfile({ ...profile, emergency_contact_phone: e.target.value })} />
        </div>
      </div>

      <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
    </div>
  );
};

export default ProfileEditor;
