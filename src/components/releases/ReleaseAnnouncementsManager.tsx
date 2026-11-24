import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Megaphone, Pencil, Plus, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ReleaseAnnouncementModal } from './ReleaseAnnouncementModal';
import {
  RELEASE_ROLE_OPTIONS,
  RELEASE_SEVERITY_LABELS,
  formatReleaseDate,
  releaseAudienceLabel,
  type ReleaseAcknowledgement,
  type ReleaseAnnouncement,
  type ReleaseRole,
  type ReleaseSeverity,
} from '@/lib/releaseAnnouncements';

interface FormState {
  version: string;
  release_date: string;
  title: string;
  summary: string;
  meaning: string;
  how_it_works: string;
  severity: ReleaseSeverity;
  target_roles: ReleaseRole[];
  ends_at: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): FormState => ({
  version: `${today()}-1`,
  release_date: today(),
  title: '',
  summary: '',
  meaning: '',
  how_it_works: '',
  severity: 'info',
  target_roles: [],
  ends_at: '',
});

const formFor = (item: ReleaseAnnouncement): FormState => ({
  version: item.version,
  release_date: item.release_date,
  title: item.title,
  summary: item.summary,
  meaning: item.meaning,
  how_it_works: item.how_it_works,
  severity: item.severity,
  target_roles: item.target_roles,
  ends_at: item.ends_at ? item.ends_at.slice(0, 16) : '',
});

export function ReleaseAnnouncementsManager() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReleaseAnnouncement[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<ReleaseAcknowledgement[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ReleaseAnnouncement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [preview, setPreview] = useState<ReleaseAnnouncement | null>(null);
  const [showAcknowledgements, setShowAcknowledgements] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [announcementResult, acknowledgementResult, profileResult] = await Promise.all([
      supabase.from('release_announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('release_announcement_acknowledgements').select('*').order('acknowledged_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,email'),
    ]);
    if (announcementResult.error || acknowledgementResult.error) {
      toast.error(announcementResult.error?.message ?? acknowledgementResult.error?.message ?? 'Nyheterna kunde inte hämtas.');
    } else {
      setItems((announcementResult.data ?? []) as ReleaseAnnouncement[]);
      setAcknowledgements((acknowledgementResult.data ?? []) as ReleaseAcknowledgement[]);
    }
    const names: Record<string, string> = {};
    (profileResult.data ?? []).forEach(profile => {
      names[profile.id] = profile.full_name || profile.email || profile.id;
    });
    setProfiles(names);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const acknowledgementCounts = useMemo(() => acknowledgements.reduce<Record<string, number>>((counts, acknowledgement) => {
    counts[acknowledgement.announcement_id] = (counts[acknowledgement.announcement_id] ?? 0) + 1;
    return counts;
  }, {}), [acknowledgements]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (item: ReleaseAnnouncement) => {
    setEditing(item);
    setForm(formFor(item));
    setFormOpen(true);
  };

  const previewForm = () => {
    setPreview({
      id: editing?.id ?? 'preview',
      ...form,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: true,
      published_at: new Date().toISOString(),
      created_by: user?.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  };

  const save = async () => {
    if (!user) return;
    if (!form.version.trim() || !form.title.trim() || !form.summary.trim() || !form.meaning.trim() || !form.how_it_works.trim()) {
      toast.error('Fyll i version, titel och alla tre förklaringstexter.');
      return;
    }
    setSaving(true);
    const payload = {
      version: form.version.trim(),
      release_date: form.release_date,
      title: form.title.trim(),
      summary: form.summary.trim(),
      meaning: form.meaning.trim(),
      how_it_works: form.how_it_works.trim(),
      severity: form.severity,
      target_roles: form.target_roles,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
    const result = editing
      ? await supabase.from('release_announcements').update(payload).eq('id', editing.id)
      : await supabase.from('release_announcements').insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(editing ? 'Nyheten är uppdaterad.' : 'Nyhetsutkastet är sparat.');
    setFormOpen(false);
    await load();
  };

  const toggleActive = async (item: ReleaseAnnouncement) => {
    const activate = !item.is_active;
    const { error } = await supabase.from('release_announcements').update({
      is_active: activate,
      published_at: activate ? (item.published_at ?? new Date().toISOString()) : item.published_at,
    }).eq('id', item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(activate ? 'Nyheten är publicerad.' : 'Nyheten är avaktiverad. Historiken finns kvar.');
    await load();
  };

  const toggleRole = (role: ReleaseRole, checked: boolean) => {
    setForm(previous => ({
      ...previous,
      target_roles: checked
        ? [...new Set([...previous.target_roles, role])]
        : previous.target_roles.filter(value => value !== role),
    }));
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Nyheter i FETCH</h1>
              <p className="text-sm text-muted-foreground">Skapa tydliga releasemeddelanden och följ kvitteringar.</p>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Uppdatera</Button>
            <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Ny nyhet</Button>
          </div>
        </header>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Hämtar nyheter…</Card>
        ) : items.length === 0 ? (
          <Card className="p-10 text-center">
            <Megaphone className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="font-semibold">Inga nyheter ännu</h2>
            <p className="mt-1 text-sm text-muted-foreground">Skapa den första nyheten som ett utkast och publicera den när den är granskad.</p>
            <Button className="mt-4" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Skapa nyhet</Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const itemAcknowledgements = acknowledgements.filter(ack => ack.announcement_id === item.id);
              return (
                <Card key={item.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={item.is_active ? 'default' : 'secondary'}>{item.is_active ? 'Publicerad' : item.published_at ? 'Avaktiverad' : 'Utkast'}</Badge>
                        <Badge variant="outline">{RELEASE_SEVERITY_LABELS[item.severity]}</Badge>
                        <span className="text-xs text-muted-foreground">{formatReleaseDate(item.release_date)} · {item.version}</span>
                      </div>
                      <h2 className="font-semibold">{item.title}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span>Målgrupp: {releaseAudienceLabel(item.target_roles)}</span>
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{acknowledgementCounts[item.id] ?? 0} kvitteringar</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPreview(item)}><Eye className="mr-1.5 h-4 w-4" />Förhandsvisa</Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}><Pencil className="mr-1.5 h-4 w-4" />Redigera</Button>
                      <Button variant={item.is_active ? 'secondary' : 'default'} size="sm" onClick={() => void toggleActive(item)}>
                        {item.is_active ? 'Avaktivera' : 'Publicera'}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <button className="text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={() => setShowAcknowledgements(showAcknowledgements === item.id ? null : item.id)}>
                      {showAcknowledgements === item.id ? 'Dölj kvitteringar' : 'Visa vilka som kvitterat'}
                    </button>
                    {showAcknowledgements === item.id && (
                      <div className="mt-3 space-y-1.5 text-sm">
                        {itemAcknowledgements.length === 0 ? <p className="text-muted-foreground">Ingen har kvitterat ännu.</p> : itemAcknowledgements.map(ack => (
                          <div key={ack.id} className="flex flex-wrap justify-between gap-2 rounded bg-muted/40 px-3 py-2">
                            <span>{profiles[ack.user_id] ?? ack.user_id}</span>
                            <span className="text-xs text-muted-foreground">{new Date(ack.acknowledged_at).toLocaleString('sv-SE')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Redigera nyhet' : 'Skapa nyhet'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="release-version">Version</Label><Input id="release-version" value={form.version} onChange={event => setForm({ ...form, version: event.target.value })} placeholder="2026-11-24-1" /></div>
            <div className="space-y-2"><Label htmlFor="release-date">Releasedatum</Label><Input id="release-date" type="date" value={form.release_date} onChange={event => setForm({ ...form, release_date: event.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="release-title">Titel</Label><Input id="release-title" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="release-summary">Kort förklaring – Vad är nytt?</Label><Textarea id="release-summary" rows={2} value={form.summary} onChange={event => setForm({ ...form, summary: event.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="release-meaning">Vad betyder detta för dig?</Label><Textarea id="release-meaning" rows={3} value={form.meaning} onChange={event => setForm({ ...form, meaning: event.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="release-how">Hur fungerar det?</Label><Textarea id="release-how" rows={3} value={form.how_it_works} onChange={event => setForm({ ...form, how_it_works: event.target.value })} /></div>
            <div className="space-y-2"><Label>Nivå</Label><Select value={form.severity} onValueChange={value => setForm({ ...form, severity: value as ReleaseSeverity })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RELEASE_SEVERITY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="release-ends">Slutar visas (valfritt)</Label><Input id="release-ends" type="datetime-local" value={form.ends_at} onChange={event => setForm({ ...form, ends_at: event.target.value })} /></div>
            <fieldset className="space-y-3 rounded-md border border-border p-3 sm:col-span-2">
              <legend className="px-1 text-sm font-medium">Målgrupp</legend>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.target_roles.length === 0} onCheckedChange={checked => checked && setForm({ ...form, target_roles: [] })} />All personal</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {RELEASE_ROLE_OPTIONS.map(option => <label key={option.value} className="flex items-center gap-2 text-sm"><Checkbox checked={form.target_roles.includes(option.value)} onCheckedChange={checked => toggleRole(option.value, Boolean(checked))} />{option.label}</label>)}
              </div>
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={previewForm}><Eye className="mr-2 h-4 w-4" />Förhandsvisa</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? 'Sparar…' : editing ? 'Spara ändringar' : 'Spara utkast'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReleaseAnnouncementModal
        announcement={preview}
        open={Boolean(preview)}
        onAcknowledge={() => setPreview(null)}
      />
    </div>
  );
}

export default ReleaseAnnouncementsManager;
