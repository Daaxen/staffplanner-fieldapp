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
import { EmployeePrivate, emptyEmployeePrivate, loadEmployeePrivate, saveEmployeePrivate } from '@/lib/employeePrivate';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  job_title: string | null;
  employment_type: string | null;
  avatar_url: string | null;
  installer_id: string | null;
}

export const PROFILE_EDITABLE_FIELDS = [
  'full_name', 'phone', 'address', 'postal_code', 'city', 'country',
  'job_title', 'employment_type', 'installer_id',
] as const;

const ProfileEditor = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [priv, setPriv] = useState<EmployeePrivate>(emptyEmployeePrivate());
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
      setProfile(data as unknown as Profile);
    });
    loadEmployeePrivate(user.id, 'Own profile page').then(({ data }) => {
      if (data) setPriv(data);
    });
  }, [user]);

  const set = (k: keyof Profile, v: string | null) => profile && setProfile({ ...profile, [k]: v });
  const setPrivate = (k: keyof EmployeePrivate, v: string | null) => setPriv(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!profile || !user) return;
    setBusy(true);
    const payload: Record<string, unknown> = {};
    PROFILE_EDITABLE_FIELDS.forEach((f) => {
      const v = profile[f as keyof Profile];
      payload[f] = v === '' ? null : v;
    });
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (error) { setBusy(false); return toast.error(error.message); }
    const { error: privError } = await saveEmployeePrivate(user.id, priv, 'Own profile page');
    setBusy(false);
    if (privError) toast.error(privError); else toast.success('Profile saved');
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

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-2xl mx-auto p-6 space-y-8">
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

      <Section title="Personal">
        <div className="space-y-2"><Label>Email</Label><Input value={profile.email ?? ''} disabled /></div>
        <div className="space-y-2"><Label>Full name</Label><Input value={profile.full_name ?? ''} onChange={e => set('full_name', e.target.value)} /></div>
        <div className="space-y-2"><Label>Phone</Label><Input value={profile.phone ?? ''} onChange={e => set('phone', e.target.value)} /></div>
        <div className="space-y-2"><Label>Date of birth</Label><Input type="date" value={priv.date_of_birth ?? ''} onChange={e => setPrivate('date_of_birth', e.target.value)} /></div>
      </Section>

      <Section title="Home address">
        <div className="space-y-2 md:col-span-2"><Label>Street address</Label><Textarea value={profile.address ?? ''} onChange={e => set('address', e.target.value)} /></div>
        <div className="space-y-2"><Label>Postal code</Label><Input value={profile.postal_code ?? ''} onChange={e => set('postal_code', e.target.value)} /></div>
        <div className="space-y-2"><Label>City</Label><Input value={profile.city ?? ''} onChange={e => set('city', e.target.value)} /></div>
        <div className="space-y-2"><Label>Country</Label><Input value={profile.country ?? ''} onChange={e => set('country', e.target.value)} /></div>
      </Section>

      <Section title="Emergency contact">
        <p className="md:col-span-2 text-xs text-muted-foreground">
          Confidential. Only you and HR can see this information.
        </p>
        <div className="space-y-2"><Label>Name</Label><Input value={priv.emergency_contact_name ?? ''} onChange={e => setPrivate('emergency_contact_name', e.target.value)} /></div>
        <div className="space-y-2"><Label>Phone</Label><Input value={priv.emergency_contact_phone ?? ''} onChange={e => setPrivate('emergency_contact_phone', e.target.value)} /></div>
        <div className="space-y-2"><Label>Relation</Label><Input placeholder="Spouse, parent…" value={priv.emergency_contact_relation ?? ''} onChange={e => setPrivate('emergency_contact_relation', e.target.value)} /></div>
        <div className="space-y-2"><Label>Medical notes / allergies</Label><Input value={priv.medical_notes ?? ''} onChange={e => setPrivate('medical_notes', e.target.value)} /></div>
        <div className="space-y-2"><Label>Second contact name</Label><Input value={priv.emergency_contact2_name ?? ''} onChange={e => setPrivate('emergency_contact2_name', e.target.value)} /></div>
        <div className="space-y-2"><Label>Second contact phone</Label><Input value={priv.emergency_contact2_phone ?? ''} onChange={e => setPrivate('emergency_contact2_phone', e.target.value)} /></div>
      </Section>

      <Section title="Work">
        <div className="space-y-2"><Label>Job title</Label><Input value={profile.job_title ?? ''} onChange={e => set('job_title', e.target.value)} /></div>
        <div className="space-y-2">
          <Label>Employment type</Label>
          <Select value={profile.employment_type ?? 'none'} onValueChange={v => set('employment_type', v === 'none' ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Not set —</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="sub_vendor">Sub-vendor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Employment start date</Label><Input type="date" value={priv.employment_start_date ?? ''} disabled /></div>
        <div className="space-y-2"><Label>Driver's licence</Label><Input placeholder="B, C1E…" value={priv.drivers_license ?? ''} onChange={e => setPrivate('drivers_license', e.target.value)} /></div>
        <div className="space-y-2"><Label>Clothing size</Label><Input value={priv.clothing_size ?? ''} onChange={e => setPrivate('clothing_size', e.target.value)} /></div>
        <div className="space-y-2"><Label>Shoe size</Label><Input value={priv.shoe_size ?? ''} onChange={e => setPrivate('shoe_size', e.target.value)} /></div>

        <div className="space-y-2 md:col-span-2">
          <Label>Linked installer</Label>
          <Select value={profile.installer_id ?? 'none'} onValueChange={v => set('installer_id', v === 'none' ? null : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {installers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
    </div>
    </div>
  );
};

export default ProfileEditor;
