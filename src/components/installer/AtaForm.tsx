import { useRef, useState } from 'react';
import { Camera, FilePlus2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addDeviationPhoto, queueDeviation } from '@/lib/deviations';
import { useOnlineStatus } from '@/hooks/useOffline';
import { ataDescription } from '@/lib/ata';

interface Props { projectRef: string; projectName?: string; installerName?: string }

/** Quick ÄTA registration on site: what, extra time/material, who approved, optional photo. */
const AtaForm = ({ projectRef, projectName, installerName }: Props) => {
  const [what, setWhat] = useState('');
  const [extra, setExtra] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const online = useOnlineStatus();

  const capture = async (files: FileList | null) => {
    if (!files) return;
    const ids: string[] = [];
    for (const f of Array.from(files)) ids.push(await addDeviationPhoto(f, projectRef));
    setPhotoIds(p => [...p, ...ids]);
  };

  const submit = async () => {
    if (!what.trim()) return;
    setSaving(true);
    try {
      await queueDeviation({
        id: `${projectRef}-ata-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectRef, projectName, installerName, category: 'ata', severity: 'low',
        description: ataDescription(what, extra, approvedBy), photoIds, occurredAt: new Date().toISOString(),
      });
      toast.success(online ? 'ÄTA sparad – kontoret har fått den' : 'ÄTA sparad – skickas när du får täckning');
      setWhat(''); setExtra(''); setApprovedBy(''); setPhotoIds([]);
    } catch {
      toast.error('ÄTA kunde inte sparas. Försök igen.');
    } finally { setSaving(false); }
  };

  return (
    <section className="rounded-2xl border border-status-on-hold/50 bg-status-on-hold/10 p-3 space-y-3">
      <h3 className="flex items-center gap-2 text-base font-bold text-foreground"><FilePlus2 className="w-4 h-4" />Ny ÄTA</h3>
      <div><Label htmlFor="ata-what">Vad ska göras? *</Label><Textarea id="ata-what" placeholder="T.ex. extra hylla monteras på kundens begäran" value={what} onChange={e => setWhat(e.target.value)} /></div>
      <div><Label htmlFor="ata-extra">Uppskattad extra tid / material</Label><Input id="ata-extra" placeholder="T.ex. 2 h + 1 hyllplan" value={extra} onChange={e => setExtra(e.target.value)} /></div>
      <div><Label htmlFor="ata-approved">Godkänd av hos kunden</Label><Input id="ata-approved" placeholder="Namn på kontaktperson" value={approvedBy} onChange={e => setApprovedBy(e.target.value)} /></div>
      <input ref={file} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => void capture(e.target.files)} />
      <Button type="button" variant="outline" className="w-full" onClick={() => file.current?.click()}><Camera className="w-4 h-4 mr-2" />{photoIds.length ? `${photoIds.length} foto tillagda` : 'Lägg till foto (valfritt)'}</Button>
      <Button type="button" className="w-full font-bold" disabled={saving || !what.trim()} onClick={() => void submit()}>Spara ÄTA</Button>
      <p className="text-xs text-muted-foreground">Timmarna rapporterar du under Logg – bocka i "ÄTA-timmar".</p>
    </section>
  );
};

export default AtaForm;
