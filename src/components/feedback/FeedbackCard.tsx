import { useState } from 'react';
import { ChevronDown, ChevronUp, Paperclip, ThumbsUp } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  FEEDBACK_STATUSES, VOTABLE_TYPES, attachmentUrl, priorityLabel, statusLabel, typeLabel,
  type FeedbackItem, type FeedbackStatus,
} from '@/lib/feedback';

const priorityTone: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-secondary text-secondary-foreground',
  high: 'bg-primary/15 text-primary',
  critical: 'bg-destructive/15 text-destructive',
};

interface Props {
  item: FeedbackItem;
  isAdmin: boolean;
  onVote: (item: FeedbackItem) => void;
  onStatus?: (id: string, status: FeedbackStatus) => void;
}

const FeedbackCard = ({ item, isAdmin, onVote, onStatus }: Props) => {
  const [open, setOpen] = useState(false);
  const votable = VOTABLE_TYPES.includes(item.type);

  const openAttachment = async (path: string) => {
    const url = await attachmentUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        {votable && (
          <button
            onClick={() => onVote(item)}
            aria-label={item.votedByMe ? 'Ta bort din röst' : 'Rösta på förslaget'}
            className={cn(
              'flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-xs font-semibold transition-colors',
              item.votedByMe
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {item.votes}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium text-sm text-foreground">{item.title}</p>
            <Badge variant="outline" className="text-[10px]">{typeLabel(item.type)}</Badge>
            <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', priorityTone[item.priority])}>
              {priorityLabel(item.priority)}
            </span>
            <Badge variant="secondary" className="text-[10px]">{statusLabel(item.status)}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.reporter_name ?? 'Okänd'} · {item.reporter_role ?? '—'} · {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}
          </p>
          <button onClick={() => setOpen(o => !o)} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {open ? 'Dölj detaljer' : 'Visa detaljer'}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {item.description && <p className="whitespace-pre-wrap text-sm text-foreground">{item.description}</p>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div><dt className="inline font-medium">Sida: </dt><dd className="inline">{item.page_path ?? '—'}</dd></div>
            <div><dt className="inline font-medium">Enhet: </dt><dd className="inline">{item.device ?? '—'}</dd></div>
            <div><dt className="inline font-medium">Webbläsare: </dt><dd className="inline">{item.browser ?? '—'}</dd></div>
            <div><dt className="inline font-medium">Ordernummer: </dt><dd className="inline">{item.order_number ?? '—'}</dd></div>
            <div><dt className="inline font-medium">Projektnummer: </dt><dd className="inline">{item.project_number ?? '—'}</dd></div>
            {item.resolved_at && (
              <div><dt className="inline font-medium">Löst: </dt><dd className="inline">{format(new Date(item.resolved_at), 'yyyy-MM-dd')}</dd></div>
            )}
          </dl>

          {item.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.attachments.map(p => (
                <Button key={p} size="sm" variant="outline" onClick={() => void openAttachment(p)}>
                  <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                  {p.split('/').pop()?.slice(0, 18)}
                </Button>
              ))}
            </div>
          )}

          {item.admin_note && (
            <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
              <span className="font-medium">Handläggning: </span>{item.admin_note}
            </p>
          )}

          {isAdmin && onStatus && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status</span>
              <Select value={item.status} onValueChange={v => onStatus(item.id, v as FeedbackStatus)}>
                <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FEEDBACK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedbackCard;
