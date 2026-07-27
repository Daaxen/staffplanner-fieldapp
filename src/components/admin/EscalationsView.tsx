import { Flame, AlertTriangle, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useReminders, type ReminderLevel } from '@/hooks/useReminders';

const levelStyle: Record<ReminderLevel, string> = {
  gentle: 'border-status-scheduled/40 bg-status-scheduled/5',
  urgent: 'border-status-on-hold/50 bg-status-on-hold/10',
  escalated: 'border-destructive/60 bg-destructive/10',
};
const LevelIcon: Record<ReminderLevel, typeof Bell> = {
  gentle: Bell, urgent: AlertTriangle, escalated: Flame,
};

const EscalationsView = () => {
  const { reminders, loading } = useReminders({ adminScope: true });

  return (
    <div className="p-6 overflow-auto">
      <div className="mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Flame className="w-5 h-5 text-destructive" />
          Escalations & overdue reports
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Installers who haven't closed the order or logged time/mileage/cost after the deadline.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : reminders.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing overdue right now.</p>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => {
            const Icon = LevelIcon[r.level];
            const missing = Object.entries(r.missing || {}).filter(([, v]) => v).map(([k]) => k).join(', ');
            return (
              <div key={r.id} className={cn('rounded-md border px-3 py-2 flex items-center gap-3', levelStyle[r.level])}>
                <Icon className="w-4 h-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.project_name ?? r.project_id}</div>
                  <div className="text-xs text-muted-foreground">
                    installer {r.installer_id.slice(0, 8)}… · {formatDistanceToNow(new Date(r.triggered_at), { addSuffix: true })} · missing: {missing || '—'}
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider">{r.level}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EscalationsView;
