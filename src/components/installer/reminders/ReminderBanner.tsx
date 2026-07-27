import { AlertTriangle, Flame, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReminderLevel } from '@/hooks/useReminders';

interface Props {
  level: ReminderLevel | null;
  count: number;
  onClick?: () => void;
}

const map: Record<ReminderLevel, { icon: typeof Bell; classes: string; label: string }> = {
  gentle:    { icon: Bell,          classes: 'bg-status-scheduled/15 text-status-scheduled border-status-scheduled/40', label: 'reminder' },
  urgent:    { icon: AlertTriangle, classes: 'bg-status-on-hold/20 text-status-on-hold border-status-on-hold/50',       label: 'urgent report' },
  escalated: { icon: Flame,         classes: 'bg-destructive/15 text-destructive border-destructive/60 animate-pulse',  label: 'escalated to admin' },
};

const ReminderBanner = ({ level, count, onClick }: Props) => {
  if (!level || count === 0) return null;
  const meta = map[level];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-4 py-2 text-xs font-medium border-b',
        meta.classes,
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 text-left">
        {count} {count === 1 ? meta.label : `${meta.label}s`} — tap to review
      </span>
    </button>
  );
};

export default ReminderBanner;
