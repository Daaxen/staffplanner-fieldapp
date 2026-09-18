import { useMemo } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjects } from '@/lib/appData';
import { useProfitabilityData } from '@/hooks/useProfitabilityData';
import {
  alertBg,
  alertColor,
  computeProfitability,
  emptyInput,
  profitabilityAlerts,
  type ProfitabilityAlert,
} from '@/lib/profitability';

interface Row {
  id: string;
  name: string;
  client: string;
  alerts: ProfitabilityAlert[];
  critical: boolean;
}

const ProfitabilityAlerts = ({ onOpenOrder }: { onOpenOrder?: (projectId: string) => void }) => {
  const [projects] = useProjects();
  const { inputs, loading } = useProfitabilityData();

  const rows = useMemo<Row[]>(() => {
    return projects
      .filter(p => p.status !== 'cancelled')
      .map(p => {
        const input = { ...(inputs[p.id] ?? emptyInput(p)), project: p };
        const alerts = profitabilityAlerts(p, computeProfitability(input));
        return {
          id: p.id,
          name: p.name,
          client: p.client,
          alerts,
          critical: alerts.some(a => a.severity === 'critical'),
        };
      })
      .filter(r => r.alerts.length > 0)
      .sort((a, b) => Number(b.critical) - Number(a.critical) || b.alerts.length - a.alerts.length);
  }, [projects, inputs]);

  const total = rows.reduce((n, r) => n + r.alerts.length, 0);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('w-4 h-4', rows.length ? 'text-status-cancelled' : 'text-muted-foreground')} />
          <h3 className="font-semibold text-foreground">Profitability alerts</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${total} warning${total === 1 ? '' : 's'} on ${rows.length} order${rows.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {!loading && rows.length === 0 && (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-status-completed" />
          All orders are within budget and above the margin target.
        </div>
      )}

      <div className="divide-y divide-border">
        {rows.map(row => (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpenOrder?.(row.id)}
            className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <p className="font-medium text-foreground text-sm">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.id} · {row.client || 'No client'}</p>
            <div className="mt-2 space-y-1.5">
              {row.alerts.map(alert => (
                <div
                  key={alert.kind}
                  className={cn('rounded-lg border px-2.5 py-1.5', alertBg(alert.severity))}
                >
                  <p className={cn('text-xs font-semibold', alertColor(alert.severity))}>{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.detail}</p>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProfitabilityAlerts;
