import { useMemo } from 'react';
import { Clock, Receipt, Timer, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { expenseCategoryLabels } from '@/data/logsData';
import type { Project } from '@/data/mockData';
import type { InstallerLogs } from '@/hooks/useInstallerLogs';

interface LogsOverviewProps {
  logs: InstallerLogs;
  projects: Project[];
}

const money = (amount: number) => `${amount.toLocaleString('sv-SE')} SEK`;

const LogsOverview = ({ logs, projects }: LogsOverviewProps) => {
  const time = logs.timeFor();
  const expenses = logs.expensesFor();
  const totals = useMemo(() => ({
    hours: time.reduce((sum, entry) => sum + entry.hours, 0),
    costs: expenses.reduce((sum, entry) => sum + entry.amount, 0),
    km: expenses.reduce((sum, entry) => sum + (entry.km ?? 0), 0),
  }), [time, expenses]);
  const projectName = (id: string) => projects.find(project => project.id === id)?.name ?? id;

  return (
    <div className="p-4 space-y-4 pb-20">
      {logs.activeTimer && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
          <Timer className="w-5 h-5 text-primary" />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">Timer running</p><p className="text-xs text-muted-foreground truncate">{projectName(logs.activeTimer.projectId)}</p></div>
          <Button size="sm" variant="destructive" onClick={() => void logs.stopTimer()}>Stop</Button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-card p-3"><Clock className="w-4 h-4 text-muted-foreground mb-2" /><p className="text-lg font-bold text-foreground">{totals.hours.toFixed(1)} h</p><p className="text-xs text-muted-foreground">Time</p></div>
        <div className="rounded-lg border border-border bg-card p-3"><Receipt className="w-4 h-4 text-muted-foreground mb-2" /><p className="text-lg font-bold text-foreground">{money(totals.costs)}</p><p className="text-xs text-muted-foreground">Costs</p></div>
        <div className="rounded-lg border border-border bg-card p-3"><Wallet className="w-4 h-4 text-muted-foreground mb-2" /><p className="text-lg font-bold text-foreground">{totals.km.toFixed(1)}</p><p className="text-xs text-muted-foreground">Kilometres</p></div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Recent time</h2>
        {time.length === 0 ? <p className="text-sm text-muted-foreground py-3">No time reported yet.</p> : time.map(entry => (
          <div key={entry.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"><Clock className="w-4 h-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground truncate">{projectName(entry.projectId)}</p><p className="text-xs text-muted-foreground">{entry.date}{entry.startTime ? ` · ${entry.startTime}–${entry.endTime}` : ''}</p></div><span className="text-sm font-semibold text-foreground">{entry.hours.toFixed(2)} h</span></div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Recent costs & mileage</h2>
        {expenses.length === 0 ? <p className="text-sm text-muted-foreground py-3">No costs or mileage reported yet.</p> : expenses.map(entry => (
          <div key={entry.id} className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"><Receipt className="w-4 h-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground truncate">{projectName(entry.projectId)}</p><p className="text-xs text-muted-foreground">{entry.date} · {expenseCategoryLabels[entry.category]}{entry.km ? ` · ${entry.km} km` : ''}</p></div><span className="text-sm font-semibold text-foreground">{money(entry.amount)}</span></div>
        ))}
      </section>
    </div>
  );
};

export default LogsOverview;