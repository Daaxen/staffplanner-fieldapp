import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Camera, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  DEVIATION_CATEGORIES,
  DEVIATION_SEVERITIES,
  MIN_DEVIATION_DESCRIPTION,
  addDeviationPhoto,
  deviationPhotoUrl,
  queueDeviation,
  type DeviationCategory,
  type DeviationSeverity,
} from '@/lib/deviations';
import { useOnlineStatus } from '@/hooks/useOffline';

interface DeviationFormProps {
  projectRef: string;
  projectName?: string;
  installerName?: string;
  onDone?: () => void;
  className?: string;
}

const severityStyle: Record<DeviationSeverity, string> = {
  low: 'border-status-scheduled/50 bg-status-scheduled/10',
  medium: 'border-status-in-progress/50 bg-status-in-progress/10',
  high: 'border-status-on-hold/60 bg-status-on-hold/15',
  critical: 'border-destructive/60 bg-destructive/15',
};

const DeviationForm = ({ projectRef, projectName, installerName, onDone, className }: DeviationFormProps) => {
  const [category, setCategory] = useState<DeviationCategory | null>(null);
  const [severity, setSeverity] = useState<DeviationSeverity>('medium');
  const [description, setDescription] = useState('');
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [occurredAt] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    photoIds
      .filter(id => !previews[id])
      .forEach(id => {
        void deviationPhotoUrl(id).then(url => {
          if (url) setPreviews(prev => ({ ...prev, [id]: url }));
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoIds]);

  const capture = async (files: FileList | null) => {
    if (!files) return;
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      ids.push(await addDeviationPhoto(file, projectRef));
    }
    setPhotoIds(prev => [...prev, ...ids]);
  };

  const ready =
    !!category && description.trim().length >= MIN_DEVIATION_DESCRIPTION && photoIds.length > 0;

  const submit = async () => {
    if (!ready || !category) return;
    setSaving(true);
    try {
      await queueDeviation({
        id: `${projectRef}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        projectRef,
        projectName,
        installerName,
        category,
        severity,
        description: description.trim(),
        photoIds,
        occurredAt: occurredAt.toISOString(),
      });
      toast.success(
        online ? 'Deviation reported — the office has been notified' : 'Deviation saved — it sends when you reconnect',
      );
      setCategory(null);
      setSeverity('medium');
      setDescription('');
      setPhotoIds([]);
      setPreviews({});
      onDone?.();
    } catch {
      toast.error('Could not save the deviation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-3 space-y-4', className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />
        Registered {format(occurredAt, 'd MMM yyyy HH:mm')}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">What happened?</p>
        <div className="grid grid-cols-2 gap-2">
          {DEVIATION_CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                'rounded-xl border px-3 py-3 text-sm text-left font-medium transition-colors',
                category === c.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-background text-muted-foreground',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">How serious is it?</p>
        <div className="grid grid-cols-2 gap-2">
          {DEVIATION_SEVERITIES.map(s => (
            <button
              key={s.id}
              onClick={() => setSeverity(s.id)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-left transition-colors',
                severity === s.id ? severityStyle[s.id] : 'border-border bg-background',
              )}
            >
              <span className="block text-sm font-semibold text-foreground">{s.label}</span>
              <span className="block text-[11px] text-muted-foreground">{s.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Describe it</p>
        <Textarea
          value={description}
          maxLength={2000}
          onChange={e => setDescription(e.target.value)}
          placeholder="What is wrong, what is blocked, what is needed…"
          className="min-h-[110px] text-base"
        />
        {description.trim().length > 0 && description.trim().length < MIN_DEVIATION_DESCRIPTION && (
          <p className="mt-1 text-[11px] text-muted-foreground">Please add a little more detail.</p>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Photos (at least one)</p>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={e => {
            void capture(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => fileInput.current?.click()}
          className="w-full rounded-xl border border-dashed border-border py-5 font-semibold flex flex-col items-center gap-1 text-primary"
        >
          <Camera className="w-6 h-6" />
          Add photo
        </button>
        {photoIds.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {photoIds.map(id => (
              <div key={id} className="relative aspect-square rounded-xl bg-muted overflow-hidden">
                {previews[id] ? (
                  <img src={previews[id]} alt="Deviation" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                )}
                <button
                  onClick={() => setPhotoIds(prev => prev.filter(p => p !== id))}
                  className="absolute top-1 right-1 rounded-full bg-background/90 p-1"
                  aria-label="Remove photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button size="lg" className="w-full h-12" disabled={!ready || saving} onClick={() => void submit()}>
        <AlertTriangle className="w-4 h-4 mr-2" />
        {saving ? 'Sending…' : 'Report deviation'}
      </Button>
      {!ready && (
        <p className="text-[11px] text-muted-foreground text-center">
          Pick a category, describe it and add at least one photo.
        </p>
      )}
    </div>
  );
};

export default DeviationForm;
