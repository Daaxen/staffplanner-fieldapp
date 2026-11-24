import { AlertCircle, ArrowRight, CalendarDays, Info, TriangleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  formatReleaseDate,
  RELEASE_SEVERITY_LABELS,
  type ReleaseAnnouncement,
} from '@/lib/releaseAnnouncements';

interface Props {
  announcement: ReleaseAnnouncement | null;
  open: boolean;
  remaining?: number;
  acknowledging?: boolean;
  error?: string | null;
  onAcknowledge: () => void;
  onPostpone?: () => void;
}

export function ReleaseAnnouncementModal({
  announcement,
  open,
  remaining = 1,
  acknowledging = false,
  error,
  onAcknowledge,
  onPostpone,
}: Props) {
  if (!announcement) return null;
  const SeverityIcon = announcement.severity === 'info'
    ? Info
    : announcement.severity === 'important' ? AlertCircle : TriangleAlert;

  return (
    <AlertDialog open={open} onOpenChange={() => undefined}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:p-6" data-testid="release-announcement-modal">
        <AlertDialogHeader className="space-y-3 pr-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={announcement.severity === 'action_required' ? 'destructive' : announcement.severity === 'important' ? 'default' : 'secondary'}>
              <SeverityIcon className="mr-1 h-3.5 w-3.5" />
              {RELEASE_SEVERITY_LABELS[announcement.severity]}
            </Badge>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatReleaseDate(announcement.release_date)} · {announcement.version}
            </span>
          </div>
          <AlertDialogTitle className="text-xl leading-tight">{announcement.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-relaxed text-foreground">
            {announcement.summary}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 text-left">
          <section className="rounded-lg border border-border bg-muted/40 p-4">
            <h3 className="mb-1.5 text-sm font-semibold">Vad betyder detta för dig?</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{announcement.meaning}</p>
          </section>
          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Hur fungerar det?</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{announcement.how_it_works}</p>
          </section>
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <AlertDialogFooter className="items-center gap-2 sm:justify-between sm:space-x-0">
          <span className="text-center text-xs text-muted-foreground sm:text-left">
            {remaining > 1 ? `Nyhet 1 av ${remaining}` : 'Läs och kvittera när du är redo'}
          </span>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            {error && onPostpone && (
              <AlertDialogCancel onClick={onPostpone}>Stäng tillfälligt</AlertDialogCancel>
            )}
            <AlertDialogAction onClick={onAcknowledge} disabled={acknowledging}>
              {acknowledging ? 'Sparar…' : 'Jag förstår'}
              {!acknowledging && <ArrowRight className="ml-2 h-4 w-4" />}
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
