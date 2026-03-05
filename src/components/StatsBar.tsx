import { projects, type ProjectStatus } from '@/data/mockData';
import { cn } from '@/lib/utils';

const stats: { key: ProjectStatus | 'total'; label: string; color?: string }[] = [
  { key: 'total', label: 'Total Projects' },
  { key: 'in-progress', label: 'In Progress', color: 'bg-status-in-progress' },
  { key: 'scheduled', label: 'Scheduled', color: 'bg-status-scheduled' },
  { key: 'on-hold', label: 'On Hold', color: 'bg-status-on-hold' },
  { key: 'completed', label: 'Completed', color: 'bg-status-completed' },
];

const StatsBar = () => {
  const counts: Record<string, number> = {
    total: projects.length,
    ...projects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-border bg-card">
      {stats.map(({ key, label, color }) => (
        <div key={key} className="flex items-center gap-3">
          {color && <div className={cn("w-2 h-8 rounded-full", color)} />}
          {!color && <div className="w-2 h-8 rounded-full bg-foreground/20" />}
          <div>
            <p className="text-2xl font-bold text-foreground">{counts[key] ?? 0}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
