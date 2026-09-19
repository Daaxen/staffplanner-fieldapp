import { useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  FEEDBACK_ACCEPT, FEEDBACK_PRIORITIES, FEEDBACK_TYPES, captureContext, uploadAttachment,
  type FeedbackPriority, type FeedbackType,
} from '@/lib/feedback';
import type { NewFeedback } from '@/hooks/useFeedback';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: NewFeedback) => Promise<string | null>;
  /** Context the current screen already knows about. */
  view?: string;
  orderNumber?: string | null;
  projectNumber?: string | null;
}

const FeedbackForm = ({ open, onOpenChange, onSubmit, view, orderNumber, projectNumber }: Props) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<FeedbackType>('bug');
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [description, setDescription] = useState('');
  const [paths, setPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(''); setType('bug'); setPriority('medium'); setDescription(''); setPaths([]);
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const res = await uploadAttachment(file);
      if ('error' in res) toast.error(res.error);
      else setPaths(prev => [...prev, res.path]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (title.trim().length < 3) {
      toast.error('Skriv en rubrik på minst 3 tecken.');
      return;
    }
    setSaving(true);
    const err = await onSubmit({
      title, type, priority, description, attachments: paths,
      context: captureContext({ view, orderNumber, projectNumber }),
    });
    setSaving(false);
    if (err) {
      toast.error(`Kunde inte spara: ${err}`);
      return;
    }
    toast.success('Tack! Din feedback är registrerad.');
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ny feedback</DialogTitle>
          <DialogDescription>
            Vi sparar automatiskt vem du är, när, vilken sida du var på samt enhet och webbläsare.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fb-title">Rubrik</Label>
            <Input id="fb-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Kort sammanfattning" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Select value={type} onValueChange={v => setType(v as FeedbackType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioritet</Label>
              <Select value={priority} onValueChange={v => setPriority(v as FeedbackPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEEDBACK_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fb-desc">Beskrivning</Label>
            <Textarea
              id="fb-desc" rows={5} value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Vad hände? Vad förväntade du dig i stället?"
            />
          </div>

          <div className="space-y-2">
            <Label>Bilagor / bilder</Label>
            <input
              ref={fileRef} type="file" multiple accept={FEEDBACK_ACCEPT} className="hidden"
              onChange={e => void pickFiles(e.target.files)}
            />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
              Lägg till fil
            </Button>
            {paths.length > 0 && (
              <ul className="space-y-1">
                {paths.map(p => (
                  <li key={p} className="flex items-center justify-between rounded-md bg-muted px-2 py-1 text-xs">
                    <span className="truncate">{p.split('/').pop()}</span>
                    <button type="button" onClick={() => setPaths(prev => prev.filter(x => x !== p))} aria-label="Ta bort bilaga">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Avbryt</Button>
          <Button onClick={submit} disabled={saving || uploading}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Skicka
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackForm;
