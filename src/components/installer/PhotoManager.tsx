import { useEffect, useRef, useState } from 'react';
import { Camera, CloudOff, Clock, MapPin, MessageSquare, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_PHOTO_CATEGORY,
  PHOTO_CATEGORIES,
  capturePosition,
  categoryLabel,
  formatCaptureTime,
  formatPosition,
  positionLink,
  type PhotoCategory,
} from '@/lib/photoMeta';
import {
  addPhoto,
  emptyWork,
  loadWork,
  photoUrl,
  removePhoto,
  saveWork,
  updatePhoto,
  uploadedPhotoUrl,
  type FieldWork,
  type OfflinePhoto,
} from '@/lib/offline/fieldWork';
import { useOnlineStatus } from '@/hooks/useOffline';

interface PhotoManagerProps {
  projectRef: string;
  projectName?: string;
  /** Controlled mode: pass the work record the parent already owns. */
  work?: FieldWork;
  onWorkChange?: (work: FieldWork) => void;
  onCountChange?: (count: number) => void;
  requiredShots?: { id: string; label: string }[];
  minPhotos?: number;
  className?: string;
}

const PhotoManager = ({
  projectRef,
  projectName,
  work: controlledWork,
  onWorkChange,
  onCountChange,
  requiredShots,
  minPhotos,
  className,
}: PhotoManagerProps) => {
  const [localWork, setLocalWork] = useState<FieldWork>(() => emptyWork(projectRef, projectName));
  const work = controlledWork ?? localWork;
  const [category, setCategory] = useState<PhotoCategory>(DEFAULT_PHOTO_CATEGORY);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    if (controlledWork) return;
    let active = true;
    loadWork(projectRef, projectName).then(w => {
      if (active) setLocalWork(w);
    });
    return () => {
      active = false;
    };
  }, [controlledWork, projectRef, projectName]);

  useEffect(() => {
    let active = true;
    Promise.all(
      work.photos
        .filter(p => !previews[p.id])
        .map(async p => ({
          id: p.id,
          // Photos already uploaded are read back from storage with a short-lived link.
          url: (await photoUrl(p.id)) ?? (p.path ? await uploadedPhotoUrl(p.path) : null),
        })),
    ).then(results => {
      if (!active) return;
      const next: Record<string, string> = {};
      results.forEach(r => {
        if (r.url) next[r.id] = r.url;
      });
      if (Object.keys(next).length > 0) setPreviews(prev => ({ ...prev, ...next }));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work.photos]);

  useEffect(() => {
    onCountChange?.(work.photos.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [work.photos.length]);

  const apply = (next: FieldWork) => {
    if (controlledWork) onWorkChange?.(next);
    else setLocalWork(next);
  };

  const capture = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const position = await capturePosition();
      let current = work;
      for (const file of Array.from(files)) {
        current = await addPhoto(current, file, { category, position });
      }
      apply(current);
      toast.success(
        online ? `${files.length} photo${files.length > 1 ? 's' : ''} added` : 'Photo saved on this phone',
        {
          description: position
            ? `${categoryLabel(category)} · location saved`
            : `${categoryLabel(category)} · no location available`,
        },
      );
    } finally {
      setBusy(false);
    }
  };

  const grouped = PHOTO_CATEGORIES.map(c => ({
    ...c,
    photos: work.photos.filter(p => (p.category ?? DEFAULT_PHOTO_CATEGORY) === c.id),
  })).filter(g => g.photos.length > 0);

  const selected: OfflinePhoto | undefined = work.photos.find(p => p.id === openPhoto);

  return (
    <div className={cn('space-y-3', className)}>
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

      <div className="flex flex-wrap gap-1.5">
        {PHOTO_CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              category === c.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {PHOTO_CATEGORIES.find(c => c.id === category)?.hint}
      </p>

      {requiredShots && requiredShots.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          {requiredShots.map((s, i) => (
            <li key={s.id}>
              {i + 1}. {s.label}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => fileInput.current?.click()}
        disabled={busy}
        className="w-full rounded-xl bg-primary text-primary-foreground py-5 font-semibold flex flex-col items-center gap-1 disabled:opacity-60"
      >
        <Camera className="w-6 h-6" />
        {busy ? 'Saving…' : `Take ${categoryLabel(category).toLowerCase()} photo`}
      </button>

      {typeof minPhotos === 'number' && (
        <p className="text-[11px] text-muted-foreground">
          {work.photos.length} of at least {minPhotos} photos taken.
        </p>
      )}

      {grouped.map(group => (
        <div key={group.id} className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">
            {group.label} <span className="text-muted-foreground font-normal">({group.photos.length})</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {group.photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setOpenPhoto(photo.id)}
                className="relative aspect-square rounded-xl bg-muted overflow-hidden"
              >
                {previews[photo.id] ? (
                  <img src={previews[photo.id]} alt={group.label} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center">
                    <Camera className="w-5 h-5 text-muted-foreground/50" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-background/75 px-1.5 py-1 text-[9px] text-foreground">
                  <span className="truncate">{formatCaptureTime(photo.capturedAt)}</span>
                  <span className="flex items-center gap-0.5">
                    {photo.comment ? <MessageSquare className="w-2.5 h-2.5" /> : null}
                    {photo.position ? <MapPin className="w-2.5 h-2.5" /> : null}
                    {!photo.path ? <CloudOff className="w-2.5 h-2.5 text-status-on-hold" /> : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Photo details</p>
            <button onClick={() => setOpenPhoto(null)} aria-label="Close" className="p-2 -mr-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {previews[selected.id] && (
              <img src={previews[selected.id]} alt="Photo" className="w-full rounded-xl object-contain max-h-72" />
            )}
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatCaptureTime(selected.capturedAt) || 'Unknown time'}
              </p>
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {selected.position ? (
                  <a
                    href={positionLink(selected.position)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {formatPosition(selected.position)}
                  </a>
                ) : (
                  'No GPS location saved'
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Category</p>
              <div className="flex flex-wrap gap-1.5">
                {PHOTO_CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => void updatePhoto(work, selected.id, { category: c.id }).then(apply)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium',
                      (selected.category ?? DEFAULT_PHOTO_CATEGORY) === c.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Comment</p>
              <Textarea
                value={selected.comment ?? ''}
                maxLength={500}
                placeholder="What does this photo show?"
                onChange={e => void updatePhoto(work, selected.id, { comment: e.target.value }).then(apply)}
                className="min-h-[90px] text-base"
              />
            </div>

            <Button
              variant="outline"
              className="w-full text-status-cancelled"
              onClick={() => {
                void removePhoto(work, selected.id).then(next => {
                  apply(next);
                  setOpenPhoto(null);
                });
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete photo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoManager;
