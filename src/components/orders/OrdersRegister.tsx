import { useMemo, useState } from 'react';
import { Search, Filter, X, CheckSquare, Square, Download, History, Users as UsersIcon, Trash2, ArrowRight, AlertTriangle, Check } from 'lucide-react';
import { installers, type Project, type ProjectStatus, type ProjectType, statusLabels, projectTypeLabels, projectTypeIcons } from '@/data/mockData';
import { transitionError } from '@/lib/validation/controlledValues';
import {
  COMMERCIAL_STATUSES, commercialLabels, commercialStatusOf, canTransitionCommercial,
  commercialTransitionError, type CommercialStatus,
} from '@/lib/commercial';

import { useProjects } from '@/lib/appData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import OrdersImport from './OrdersImport';

type SortKey = 'name' | 'client' | 'startDate' | 'endDate' | 'status' | 'projectType';
type SortDir = 'asc' | 'desc';

const allStatuses: ProjectStatus[] = ['open', 'scheduled', 'in-progress', 'completed', 'on-hold', 'cancelled'];
const allTypes: ProjectType[] = ['installation', 'site-survey', 'transport'];

const statusDot: Record<ProjectStatus, string> = {
  'open': 'bg-status-open',
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
};

const todayStr = new Date().toISOString().slice(0, 10);

const OrdersRegister = () => {
  const [orders, setOrders] = useProjects();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus[]>([]);
  const [typeFilter, setTypeFilter] = useState<ProjectType[]>([]);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [historicalOnly, setHistoricalOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('startDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(true);
  const [massDialog, setMassDialog] = useState<null | 'status' | 'assignee' | 'delete'>(null);
  const [massStep, setMassStep] = useState<'configure' | 'preview'>('configure');
  const [massStatus, setMassStatus] = useState<ProjectStatus>('scheduled');
  const [massAssignee, setMassAssignee] = useState<string>('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const openMassDialog = (kind: 'status' | 'assignee' | 'delete') => {
    setMassStep('configure');
    setDeleteConfirmText('');
    setMassDialog(kind);
  };
  const closeMassDialog = () => {
    setMassDialog(null);
    setMassStep('configure');
    setMassAssignee('');
    setDeleteConfirmText('');
  };

  const selectedOrders = useMemo(
    () => orders.filter(o => selected.has(o.id)),
    [orders, selected]
  );

  const installerName = (id: string) => installers.find(i => i.id === id)?.name ?? id;

  const statusPreview = useMemo(() => {
    return selectedOrders.map(o => {
      const blocked = transitionError(o.status, massStatus, statusLabels);
      return {
        id: o.id,
        name: o.name,
        client: o.client,
        from: o.status,
        to: massStatus,
        blocked,
        changed: o.status !== massStatus && !blocked,
        warning:
          (o.status === 'completed' && massStatus !== 'completed') ? 'Reopening a completed order' :
          (o.status === 'cancelled' && massStatus !== 'cancelled') ? 'Reactivating a cancelled order' :
          (massStatus === 'cancelled' && o.status === 'in-progress') ? 'Cancelling an in-progress order' :
          undefined,
      };
    });
  }, [selectedOrders, massStatus]);


  // Bulk assignment runs the same conflict and absence checks as every other path.
  const assigneePreview = useMemo(() => {
    return selectedOrders.map(o => {
      const already = !!massAssignee && o.assigneeIds.includes(massAssignee);
      const nextIds = already ? o.assigneeIds : Array.from(new Set([...o.assigneeIds, massAssignee]));
      const statusChange = !already && o.status === 'open' ? 'scheduled' as ProjectStatus : undefined;
      const conflicts = already || !massAssignee
        ? []
        : detectConflicts({
            installerIds: [massAssignee],
            draft: {
              projectId: o.id,
              startDate: o.startDate,
              endDate: o.endDate,
              startTime: o.startTime,
              endTime: o.endTime,
            },
            installers,
            projects: orders,
          });
      const blockers = conflicts.filter(c => c.severity === 'blocking');
      return {
        id: o.id,
        name: o.name,
        client: o.client,
        current: o.assigneeIds,
        next: nextIds,
        already,
        statusChange,
        blocked: blockers.length > 0,
        blockDetail: blockers[0]?.detail,
      };
    });
  }, [selectedOrders, massAssignee, orders]);

  const deletePreview = useMemo(() => {
    return selectedOrders.map(o => ({
      id: o.id,
      name: o.name,
      client: o.client,
      status: o.status,
      warning:
        o.status === 'in-progress' ? 'Currently in progress' :
        o.status === 'scheduled' ? 'Scheduled with a team' :
        undefined,
    }));
  }, [selectedOrders]);

  const clients = useMemo(
    () => Array.from(new Set(orders.map(o => o.client))).sort(),
    [orders]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = orders.filter(o => {
      if (q) {
        const hay = [o.name, o.client, o.location, o.id, o.contactName ?? '', o.contactEmail ?? '', o.contactPhone ?? '']
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter.length && !statusFilter.includes(o.status)) return false;
      if (typeFilter.length && !typeFilter.includes(o.projectType)) return false;
      if (clientFilter !== 'all' && o.client !== clientFilter) return false;
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned' ? o.assigneeIds.length > 0 : !o.assigneeIds.includes(assigneeFilter)) return false;
      }
      if (dateFrom && o.endDate < dateFrom) return false;
      if (dateTo && o.startDate > dateTo) return false;
      if (historicalOnly && !(o.status === 'completed' || o.status === 'cancelled' || o.endDate < todayStr)) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [orders, search, statusFilter, typeFilter, clientFilter, assigneeFilter, dateFrom, dateTo, historicalOnly, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  const allSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) filtered.forEach(o => next.delete(o.id));
    else filtered.forEach(o => next.add(o.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const clearFilters = () => {
    setSearch(''); setStatusFilter([]); setTypeFilter([]); setClientFilter('all');
    setAssigneeFilter('all'); setDateFrom(''); setDateTo(''); setHistoricalOnly(false);
  };
  const activeFilterCount =
    (search ? 1 : 0) + statusFilter.length + typeFilter.length +
    (clientFilter !== 'all' ? 1 : 0) + (assigneeFilter !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (historicalOnly ? 1 : 0);

  const setCommercial = (orderId: string, next: CommercialStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const current = commercialStatusOf(order);
    if (current === next) return;
    const blocked = commercialTransitionError(current, next);
    if (blocked) { toast.error(blocked); return; }
    setOrders(prev => prev.map(p => p.id === orderId ? { ...p, commercialStatus: next } : p));
    toast.success(`Commercial status set to ${commercialLabels[next]}`);
  };


  const applyMassStatus = () => {
    const blockedCount = statusPreview.filter(r => r.blocked).length;
    const changedIds = new Set(statusPreview.filter(r => r.changed).map(r => r.id));
    if (changedIds.size === 0) {
      toast.error(blockedCount ? 'That status step is not allowed for the selected orders' : 'No orders would change');
      return;
    }
    setOrders(prev => prev.map(p => changedIds.has(p.id) ? { ...p, status: massStatus } : p));
    toast.success(
      `Updated status on ${changedIds.size} order(s)` +
      (blockedCount ? ` · ${blockedCount} skipped (step not allowed)` : ''),
    );
    closeMassDialog(); setSelected(new Set());
  };

  const applyMassAssignee = () => {
    if (!massAssignee) return;
    const changedIds = new Set(assigneePreview.filter(r => !r.already).map(r => r.id));
    if (changedIds.size === 0) { toast.error('All selected orders already have this installer'); return; }
    setOrders(prev => prev.map(p =>
      changedIds.has(p.id)
        ? { ...p, assigneeIds: Array.from(new Set([...p.assigneeIds, massAssignee])), status: p.status === 'open' ? 'scheduled' : p.status }
        : p
    ));
    toast.success(`Assigned installer to ${changedIds.size} order(s)`);
    closeMassDialog(); setSelected(new Set());
  };
  const applyMassDelete = () => {
    if (deleteConfirmText !== 'DELETE') { toast.error('Type DELETE to confirm'); return; }
    setOrders(prev => prev.filter(p => !selected.has(p.id)));
    toast.success(`Removed ${selected.size} order(s)`);
    closeMassDialog(); setSelected(new Set());
  };

  const exportCsv = () => {
    const rows = filtered.length ? filtered : orders;
    const header = ['ID', 'Name', 'Type', 'Client', 'Location', 'Status', 'Start', 'End', 'Assignees', 'Contact', 'Phone', 'Email'];
    const body = rows.map(r => [
      r.id, r.name, r.projectType, r.client, r.location, r.status, r.startDate, r.endDate,
      r.assigneeIds.map(id => installers.find(i => i.id === id)?.name ?? id).join('; '),
      r.contactName ?? '', r.contactPhone ?? '', r.contactEmail ?? '',
    ]);
    const csv = [header, ...body].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const toggleStatusChip = (s: ProjectStatus) =>
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleTypeChip = (t: ProjectType) =>
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {label}
      {sortKey === k && <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="px-6 py-4 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Orders</h1>
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {orders.length} shown{selected.size > 0 ? ` · ${selected.size} selected` : ''}
            </p>
          </div>
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, client, location, ID, contact…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={historicalOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setHistoricalOnly(v => !v)}
          >
            <History className="w-4 h-4 mr-1.5" />
            Historical
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(s => !s)}>
            <Filter className="w-4 h-4 mr-1.5" />
            Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          <OrdersImport orders={orders} onApply={setOrders} />
        </div>

        {showFilters && (
          <div className="px-6 pb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {allStatuses.map(s => (
                  <button key={s} onClick={() => toggleStatusChip(s)}
                    className={cn("flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-colors",
                      statusFilter.includes(s) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", statusDot[s])} />
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {allTypes.map(t => (
                  <button key={t} onClick={() => toggleTypeChip(t)}
                    className={cn("text-[11px] px-2 py-1 rounded-full border transition-colors",
                      typeFilter.includes(t) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                    {projectTypeIcons[t]} {projectTypeLabels[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">Client</p>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 mt-3">Assignee</p>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unassigned">Unassigned only</SelectItem>
                  {installers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">Date range (overlaps)</p>
              <div className="flex flex-col gap-2">
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="mt-2 flex items-center gap-1 text-[11px] text-destructive font-medium">
                  <X className="w-3 h-3" /> Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="px-6 py-2 border-t border-border bg-primary/5 flex items-center gap-2">
            <span className="text-xs font-medium text-foreground mr-2">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => openMassDialog('status')}>Change status</Button>
            <Button size="sm" variant="outline" onClick={() => openMassDialog('assignee')}>
              <UsersIcon className="w-3.5 h-3.5 mr-1" /> Assign installer
            </Button>
            <Button size="sm" variant="outline" onClick={() => openMassDialog('delete')}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground z-10">
            <tr>
              <th className="w-10 px-3 py-2 text-left">
                <button onClick={toggleAll} className="flex items-center">
                  {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              <th className="px-3 py-2 text-left"><SortHeader k="name" label="Order" /></th>
              <th className="px-3 py-2 text-left"><SortHeader k="projectType" label="Type" /></th>
              <th className="px-3 py-2 text-left"><SortHeader k="client" label="Client" /></th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left"><SortHeader k="status" label="Status" /></th>
              <th className="px-3 py-2 text-left">Commercial</th>
              <th className="px-3 py-2 text-left"><SortHeader k="startDate" label="Start" /></th>
              <th className="px-3 py-2 text-left"><SortHeader k="endDate" label="End" /></th>
              <th className="px-3 py-2 text-left">Assignees</th>
              <th className="px-3 py-2 text-left">Contact</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr
                key={o.id}
                className={cn("border-t border-border hover:bg-muted/30 transition-colors",
                  selected.has(o.id) && "bg-primary/5")}
              >
                <td className="px-3 py-2">
                  <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggleOne(o.id)} />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{o.name}</div>
                  <div className="text-[11px] text-muted-foreground">{o.id}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="text-xs">{projectTypeIcons[o.projectType]} {projectTypeLabels[o.projectType]}</span>
                </td>
                <td className="px-3 py-2">{o.client}</td>
                <td className="px-3 py-2 text-muted-foreground">{o.location}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={cn("w-2 h-2 rounded-full", statusDot[o.status])} />
                    {statusLabels[o.status]}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={commercialStatusOf(o)}
                    onValueChange={v => setCommercial(o.id, v as CommercialStatus)}
                  >
                    <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMMERCIAL_STATUSES.map(s => {
                        const blocked = !canTransitionCommercial(commercialStatusOf(o), s);
                        return (
                          <SelectItem key={s} value={s} disabled={blocked}>
                            {commercialLabels[s]}{blocked ? ' — not allowed yet' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{o.startDate}</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{o.endDate}</td>
                <td className="px-3 py-2">
                  {o.assigneeIds.length === 0
                    ? <span className="text-xs text-muted-foreground italic">Unassigned</span>
                    : <span className="text-xs">{o.assigneeIds.map(id => installers.find(i => i.id === id)?.name ?? id).join(', ')}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {o.contactName ?? '—'}
                  {o.contactPhone && <div className="text-[11px]">{o.contactPhone}</div>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">No orders match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mass update dialogs — configure → preview → apply */}
      <Dialog open={massDialog === 'status'} onOpenChange={o => !o && closeMassDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Change status {massStep === 'preview' && '· Preview'}</DialogTitle>
            <DialogDescription>
              {massStep === 'configure'
                ? `Pick the new status to apply to ${selected.size} selected order(s).`
                : `Review the ${statusPreview.filter(r => r.changed).length} of ${statusPreview.length} order(s) that will change.`}
            </DialogDescription>
          </DialogHeader>

          {massStep === 'configure' ? (
            <Select value={massStatus} onValueChange={v => setMassStatus(v as ProjectStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {allStatuses.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-border rounded-md divide-y divide-border">
              {statusPreview.map(r => (
                <div key={r.id} className={cn("px-3 py-2 text-sm flex items-center gap-3", !r.changed && "opacity-50")}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.client}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1"><span className={cn("w-2 h-2 rounded-full", statusDot[r.from])} />{statusLabels[r.from]}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="inline-flex items-center gap-1"><span className={cn("w-2 h-2 rounded-full", statusDot[r.to])} />{statusLabels[r.to]}</span>
                  </div>
                  <div className="w-52 text-right">
                    {r.blocked ? (
                      <span className="text-xs text-destructive inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.blocked}</span>
                    ) : !r.changed ? (
                      <span className="text-xs text-muted-foreground">No change</span>
                    ) : r.warning ? (
                      <span className="text-xs text-amber-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.warning}</span>
                    ) : (
                      <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><Check className="w-3 h-3" />Will update</span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeMassDialog}>Cancel</Button>
            {massStep === 'configure' ? (
              <Button onClick={() => setMassStep('preview')}>Preview changes</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMassStep('configure')}>Back</Button>
                <Button onClick={applyMassStatus} disabled={statusPreview.every(r => !r.changed)}>
                  Confirm & apply ({statusPreview.filter(r => r.changed).length})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={massDialog === 'assignee'} onOpenChange={o => !o && closeMassDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign installer {massStep === 'preview' && '· Preview'}</DialogTitle>
            <DialogDescription>
              {massStep === 'configure'
                ? `Add an installer to ${selected.size} selected order(s).`
                : `Review the ${assigneePreview.filter(r => !r.already).length} of ${assigneePreview.length} order(s) that will change.`}
            </DialogDescription>
          </DialogHeader>

          {massStep === 'configure' ? (
            <Select value={massAssignee} onValueChange={setMassAssignee}>
              <SelectTrigger><SelectValue placeholder="Pick installer" /></SelectTrigger>
              <SelectContent>
                {installers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="max-h-80 overflow-y-auto border border-border rounded-md divide-y divide-border">
              {assigneePreview.map(r => (
                <div key={r.id} className={cn("px-3 py-2 text-sm flex items-center gap-3", r.already && "opacity-50")}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.client}</div>
                  </div>
                  <div className="text-xs text-muted-foreground max-w-[240px] truncate">
                    {r.current.length ? r.current.map(installerName).join(', ') : '—'}
                    <ArrowRight className="w-3 h-3 inline mx-1" />
                    {r.next.map(installerName).join(', ')}
                  </div>
                  <div className="w-36 text-right">
                    {r.already ? (
                      <span className="text-xs text-muted-foreground">Already assigned</span>
                    ) : (
                      <span className="text-xs text-emerald-600 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />Add{r.statusChange ? ' + Scheduled' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeMassDialog}>Cancel</Button>
            {massStep === 'configure' ? (
              <Button onClick={() => setMassStep('preview')} disabled={!massAssignee}>Preview changes</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMassStep('configure')}>Back</Button>
                <Button onClick={applyMassAssignee} disabled={assigneePreview.every(r => r.already)}>
                  Confirm & apply ({assigneePreview.filter(r => !r.already).length})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={massDialog === 'delete'} onOpenChange={o => !o && closeMassDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delete orders {massStep === 'preview' && '· Confirm'}</DialogTitle>
            <DialogDescription>
              {massStep === 'configure'
                ? `You're about to permanently remove ${selected.size} order(s). Continue to preview.`
                : `These ${deletePreview.length} order(s) will be permanently removed. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>

          {massStep === 'preview' && (
            <>
              <div className="max-h-72 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {deletePreview.map(r => (
                  <div key={r.id} className="px-3 py-2 text-sm flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.client}</div>
                    </div>
                    <span className="text-xs inline-flex items-center gap-1">
                      <span className={cn("w-2 h-2 rounded-full", statusDot[r.status])} />
                      {statusLabels[r.status]}
                    </span>
                    {r.warning && (
                      <span className="text-xs text-amber-600 inline-flex items-center gap-1 w-40 justify-end">
                        <AlertTriangle className="w-3 h-3" />{r.warning}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type <span className="font-mono font-semibold">DELETE</span> to confirm</label>
                <Input value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="DELETE" />
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeMassDialog}>Cancel</Button>
            {massStep === 'configure' ? (
              <Button variant="destructive" onClick={() => setMassStep('preview')}>Preview deletion</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setMassStep('configure')}>Back</Button>
                <Button variant="destructive" onClick={applyMassDelete} disabled={deleteConfirmText !== 'DELETE'}>
                  Confirm & delete ({deletePreview.length})
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersRegister;
