import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { History, ArrowRight } from 'lucide-react';
import {
  allowedTransitions, statusLabels, statusBadgeMap, statusColorMap,
  transitionError, statusSequence, type ProjectStatus,
} from '@/lib/projectLifecycle';
import { fetchStatusHistory, logStatusChange, type StatusEvent } from '@/lib/statusHistory';

interface Props {
  projectRef: string;
  projectName: string;
  status: ProjectStatus;
  onChange: (next: ProjectStatus) => void;
}

const StatusControl = ({ projectRef, projectName, status, onChange }: Props) => {
  const [pending, setPending] = useState<ProjectStatus | ''>('');
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const next = allowedTransitions(status);

  const loadHistory = () => {
    setLoading(true);
    fetchStatusHistory(projectRef).then(h => { setHistory(h); setLoading(false); });
  };

  useEffect(loadHistory, [projectRef]);

  const apply = async () => {
    if (!pending) return;
    const err = transitionError(status, pending);
    if (err) { toast.error(err); return; }
    const from = status;
    onChange(pending);
    await logStatusChange({ projectRef, projectName, from, to: pending });
    toast.success(`Status changed to ${statusLabels[pending]}`);
    setPending('');
    loadHistory();
  };

  const stepIndex = statusSequence.indexOf(status);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Status</p>
        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', statusBadgeMap[status])}>
          {statusLabels[status]}
        </span>
        {stepIndex >= 0 && (
          <span className="ml-2 text-[11px] text-muted-foreground">
            Step {stepIndex + 1} of {statusSequence.length}
          </span>
        )}
      </div>

      {next.length === 0 ? (
        <p className="text-xs text-muted-foreground">This order is final and cannot change status.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={pending} onValueChange={v => setPending(v as ProjectStatus)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Move to…" />
            </SelectTrigger>
            <SelectContent>
              {next.map(s => (
                <SelectItem key={s} value={s} className="text-xs">{statusLabels[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs" disabled={!pending} onClick={apply}>Apply</Button>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Only the next step in the lifecycle is available — steps cannot be skipped.
      </p>

      <div className="pt-2 border-t border-border">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2">
          <History className="w-3.5 h-3.5" /> Status history
        </p>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No status changes recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map(e => (
              <li key={e.id} className="text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <span className={cn('w-2 h-2 rounded-full', statusColorMap[e.from_status ?? 'draft'])} />
                  {e.from_status ? statusLabels[e.from_status] : "—"}
                  <ArrowRight className="w-3 h-3" />
                  <span className={cn('w-2 h-2 rounded-full', statusColorMap[e.to_status])} />
                  {statusLabels[e.to_status]}
                </span>
                <div>
                  {new Date(e.created_at).toLocaleString()} · {e.changed_by_name ?? 'Unknown user'}
                  {e.note ? ` · ${e.note}` : ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StatusControl;
