import { Bell, AlertTriangle, Flame, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { RemindersState, ReminderLevel } from '@/hooks/useReminders';

const levelMeta: Record<ReminderLevel, { label: string; icon: typeof Bell; classes: string }> = {
  gentle:    { label: 'Reminder',       icon: Bell,           classes: 'border-status-scheduled/40 bg-status-scheduled/10' },
  urgent:    { label: 'Urgent',         icon: AlertTriangle,  classes: 'border-status-on-hold/50 bg-status-on-hold/10' },
  escalated: { label: 'Escalated',      icon: Flame,          classes: 'border-destructive/60 bg-destructive/10' },
};

interface Props { state: RemindersState; }

const RemindersInbox = ({ state }: Props) => {
  const { reminders, loading, resolve, dismiss } = state;

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading reminders…</div>;
  }
  if (reminders.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-status-completed" />
        You're all caught up.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {reminders.map((r) => {
        const meta = levelMeta[r.level];
        const Icon = meta.icon;
        const missing = Object.entries(r.missing || {})
          .filter(([, v]) => v)
          .map(([k]) => (k === 'completion' ? 'close order' : k === 'time' ? 'log time' : 'log expense/mileage'));
        return (
          <div key={r.id} className={cn('rounded-lg border p-3 space-y-2', meta.classes)}>
            <div className="flex items-start gap-2">
              <Icon className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide">{meta.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.triggered_at), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-sm font-medium mt-0.5 truncate">
                  {r.project_name ?? r.project_id}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Still needed: {missing.length ? missing.join(', ') : 'follow up'}
                </div>
              </div>
              <button onClick={() => dismiss(r.id)} className="p-1 rounded hover:bg-background/60" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs" onClick={() => resolve(r.id)}>Mark done</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RemindersInbox;
