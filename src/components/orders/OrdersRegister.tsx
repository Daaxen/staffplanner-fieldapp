import { useMemo, useState } from 'react';
import { Search, Filter, X, CheckSquare, Square, Download, History, Users as UsersIcon, Trash2 } from 'lucide-react';
import { projects as mockProjects, installers, type Project, type ProjectStatus, type ProjectType, statusLabels, projectTypeLabels, projectTypeIcons } from '@/data/mockData';
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
  const [orders, setOrders] = useState<Project[]>(mockProjects);
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
  const [massStatus, setMassStatus] = useState<ProjectStatus>('scheduled');
  const [massAssignee, setMassAssignee] = useState<string>('');

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

  const applyMassStatus = () => {
    setOrders(prev => prev.map(p => selected.has(p.id) ? { ...p, status: massStatus } : p));
    toast.success(`Updated status on ${selected.size} order(s)`);
    setMassDialog(null); setSelected(new Set());
  };
  const applyMassAssignee = () => {
    if (!massAssignee) return;
    setOrders(prev => prev.map(p =>
      selected.has(p.id)
        ? { ...p, assigneeIds: Array.from(new Set([...p.assigneeIds, massAssignee])), status: p.status === 'open' ? 'scheduled' : p.status }
        : p
    ));
    toast.success(`Assigned installer to ${selected.size} order(s)`);
    setMassDialog(null); setSelected(new Set()); setMassAssignee('');
  };
  const applyMassDelete = () => {
    setOrders(prev => prev.filter(p => !selected.has(p.id)));
    toast.success(`Removed ${selected.size} order(s)`);
    setMassDialog(null); setSelected(new Set());
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
            <Button size="sm" variant="outline" onClick={() => setMassDialog('status')}>Change status</Button>
            <Button size="sm" variant="outline" onClick={() => setMassDialog('assignee')}>
              <UsersIcon className="w-3.5 h-3.5 mr-1" /> Assign installer
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMassDialog('delete')}>
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

      {/* Mass update dialogs */}
      <Dialog open={massDialog === 'status'} onOpenChange={o => !o && setMassDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>Apply a new status to {selected.size} selected order(s).</DialogDescription>
          </DialogHeader>
          <Select value={massStatus} onValueChange={v => setMassStatus(v as ProjectStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allStatuses.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassDialog(null)}>Cancel</Button>
            <Button onClick={applyMassStatus}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={massDialog === 'assignee'} onOpenChange={o => !o && setMassDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign installer</DialogTitle>
            <DialogDescription>Add installer to {selected.size} selected order(s).</DialogDescription>
          </DialogHeader>
          <Select value={massAssignee} onValueChange={setMassAssignee}>
            <SelectTrigger><SelectValue placeholder="Pick installer" /></SelectTrigger>
            <SelectContent>
              {installers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassDialog(null)}>Cancel</Button>
            <Button onClick={applyMassAssignee} disabled={!massAssignee}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={massDialog === 'delete'} onOpenChange={o => !o && setMassDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete orders</DialogTitle>
            <DialogDescription>Permanently remove {selected.size} order(s)? This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={applyMassDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersRegister;
