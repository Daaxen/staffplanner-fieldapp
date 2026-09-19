import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Clock, Gauge, Lightbulb, ShieldAlert, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInstallersList, useProjects } from '@/lib/appData';
import { useResourceData } from '@/hooks/useResourceData';
import {
  buildResourcePlan,
  HORIZONS,
  regionsOf,
  type Horizon,
  type PlanFilters,
} from '@/lib/resourcePlanning';
import type { CapacityLevel } from '@/lib/capacity';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const levelText: Record<CapacityLevel, string> = {
  green: 'text-status-completed',
  yellow: 'text-status-in-progress',
  red: 'text-destructive',
};

const heatClass = (utilization: number, absent: boolean) => {
  if (absent) return 'bg-muted text-muted-foreground';
  if (utilization === 0) return 'bg-muted/40 text-muted-foreground';
  if (utilization > 100) return 'bg-destructive/80 text-destructive-foreground';
  if (utilization >= 85) return 'bg-status-in-progress/80 text-foreground';
  if (utilization >= 50) return 'bg-status-completed/60 text-foreground';
  return 'bg-status-completed/25 text-foreground';
};

const ResourcePlanningDashboard = () => {
  const [projects] = useProjects();
  const installers = useInstallersList();
  const { absences, overrides, loading } = useResourceData();

  const [horizon, setHorizon] = useState<Horizon>(30);
  const [filters, setFilters] = useState<PlanFilters>({ region: 'all', type: 'all' });

  const regions = useMemo(() => regionsOf(installers), [installers]);

  const plan = useMemo(
    () => buildResourcePlan(installers, projects, absences, horizon, filters, overrides.length),
    [installers, projects, absences, horizon, filters, overrides.length],
  );

  const cards = [
    { label: 'Utilization', value: `${plan.utilization} %`, icon: Gauge, tone: levelText[plan.level] },
    { label: 'Available hours', value: `${Math.round(plan.totalAvailable)} h`, icon: Clock, tone: 'text-foreground' },
    { label: 'Planned hours', value: `${Math.round(plan.totalPlanned)} h`, icon: CalendarClock, tone: 'text-foreground' },
    {
      label: 'Absence conflicts',
      value: String(plan.conflicts.length),
      icon: UserX,
      tone: plan.conflicts.length ? 'text-destructive' : 'text-status-completed',
    },
    {
      label: 'Overbooking overrides',
      value: String(overrides.length),
      icon: ShieldAlert,
      tone: overrides.length ? 'text-status-in-progress' : 'text-status-completed',
    },
    {
      label: 'Unassigned orders',
      value: String(plan.unassignedJobs.length),
      icon: AlertTriangle,
      tone: plan.unassignedJobs.length ? 'text-status-in-progress' : 'text-status-completed',
    },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Resource planning</h2>
          <p className="text-sm text-muted-foreground">
            Capacity for the next {horizon} days{loading ? ' · loading…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(horizon)} onValueChange={v => setHorizon(Number(v) as Horizon)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HORIZONS.map(h => (
                <SelectItem key={h} value={String(h)}>Next {h} days</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.region} onValueChange={v => setFilters(f => ({ ...f, region: v }))}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.type} onValueChange={v => setFilters(f => ({ ...f, type: v as PlanFilters['type'] }))}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="own">Own staff</SelectItem>
              <SelectItem value="sub-vendor">Sub-vendors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map(c => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                <c.icon className={cn('h-4 w-4', c.tone)} />
              </div>
              <p className={cn('mt-2 text-xl font-bold', c.tone)}>{c.value}</p>
            </div>
          ))}
        </div>

        {plan.tips.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Lightbulb className="h-4 w-4 text-status-in-progress" /> Planner recommendations
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {plan.tips.map((t, i) => <li key={i}>• {t.text}</li>)}
            </ul>
          </div>
        )}

        {/* Heatmap */}
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            Weekly load per person
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Person</th>
                <th className="px-3 py-2 text-right">Available</th>
                <th className="px-3 py-2 text-right">Planned</th>
                <th className="px-3 py-2 text-right">Utilization</th>
                {plan.weeks.map(w => <th key={w.start} className="px-2 py-2 text-center">{w.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {plan.rows.length === 0 && (
                <tr>
                  <td colSpan={4 + plan.weeks.length} className="px-3 py-8 text-center text-muted-foreground">
                    No staff match the current filters.
                  </td>
                </tr>
              )}
              {plan.rows.map(r => (
                <tr key={r.installer.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{r.installer.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.installer.type === 'own' ? 'Own staff' : 'Sub-vendor'}
                      {r.installer.baseLocation ? ` · ${r.installer.baseLocation}` : ''}
                      {r.absenceDays ? ` · ${r.absenceDays} absence days` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{Math.round(r.availableHours)} h</td>
                  <td className="px-3 py-2 text-right">{Math.round(r.plannedHours)} h</td>
                  <td className={cn('px-3 py-2 text-right font-semibold', levelText[r.level])}>{r.utilization} %</td>
                  {r.cells.map(c => (
                    <td key={c.weekStart} className="px-1 py-1">
                      <div
                        title={`${c.label}: ${Math.round(c.plannedHours)} h planned of ${Math.round(c.availableHours)} h${c.absent ? ' · absence' : ''}`}
                        className={cn('rounded-md py-2 text-center text-xs font-medium', heatClass(c.utilization, c.absent))}
                      >
                        {c.absent && c.plannedHours === 0 ? '—' : `${c.utilization}%`}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserX className="h-4 w-4 text-destructive" /> Absence conflicts
            </div>
            {plan.conflicts.length === 0 && (
              <p className="text-sm text-muted-foreground">No bookings clash with a planned absence.</p>
            )}
            <ul className="space-y-2">
              {plan.conflicts.map((c, i) => (
                <li key={i} className="rounded-md border border-border p-3 text-sm">
                  <div className="font-medium text-foreground">{c.installer.name} — {c.project.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Order {c.project.startDate} → {c.project.endDate} · {c.absence.type} {c.absence.startDate} → {c.absence.endDate}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldAlert className="h-4 w-4 text-status-in-progress" /> Overbooking overrides
            </div>
            {overrides.length === 0 && (
              <p className="text-sm text-muted-foreground">No double bookings have been overridden.</p>
            )}
            <ul className="space-y-2">
              {overrides.slice(0, 10).map(o => {
                const person = installers.find(i => i.id === o.installerId);
                const project = projects.find(p => p.id === o.projectId || p.ref === o.projectId);
                return (
                  <li key={o.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {person?.name ?? 'Unknown person'}{project ? ` — ${project.name}` : ''}
                      </span>
                      <Badge variant="outline">{new Date(o.createdAt).toLocaleDateString()}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{o.reason}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourcePlanningDashboard;
