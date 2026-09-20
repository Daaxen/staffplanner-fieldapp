import { useMemo, useState } from 'react';
import { CalendarClock, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Project, ProjectType } from '@/data/mockData';
import { clientRowId, useClients, useProjects } from '@/lib/appData';
import { useProjectGroups } from '@/lib/projectGroups';
import { expandSeries, WEEKDAY_LABELS, type RecurrencePause } from '@/lib/recurrence';
import {
  buildOrdersForSeries, createRecurringSeries, deleteRecurringSeries, untouchedOccurrences,
  updateRecurringSeries, useRecurringSeries,
  type RecurringSeries, type RecurringSeriesInput,
} from '@/lib/recurringOrders';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: RecurringSeriesInput = {
  name: '',
  clientRef: '',
  clientName: '',
  projectGroupId: '',
  projectType: 'installation',
  location: '',
  street: '',
  postalCode: '',
  region: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  startTime: '08:00',
  endTime: '16:00',
  estimatedHours: undefined,
  description: '',
  weekdays: [3, 4, 5],
  intervalWeeks: 1,
  seriesStart: today(),
  seriesEnd: '',
  skipHolidays: true,
  pauses: [],
  active: true,
};

const weekdayText = (days: number[]) =>
  days.length === 0
    ? '—'
    : WEEKDAY_LABELS.filter(w => days.includes(w.value)).map(w => w.label).join(', ');

const RecurringOrdersRegister = () => {
  const { series, loading, reload } = useRecurringSeries();
  const { groups } = useProjectGroups();
  const [orders, setOrders] = useProjects();
  const [clients] = useClients();

  const [form, setForm] = useState<RecurringSeriesInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RecurringSeries | null>(null);

  const sortedClients = useMemo(
    () => [...clients].filter(c => c.name).sort((a, b) => a.name.localeCompare(b.name, 'sv')),
    [clients],
  );

  const ordersBySeries = useMemo(() => {
    const map = new Map<string, Project[]>();
    orders.forEach(o => {
      if (!o.recurrenceSeriesId) return;
      const list = map.get(o.recurrenceSeriesId) ?? [];
      list.push(o);
      map.set(o.recurrenceSeriesId, list);
    });
    return map;
  }, [orders]);

  const preview = form ? expandSeries(form) : null;

  const set = <K extends keyof RecurringSeriesInput>(key: K, value: RecurringSeriesInput[K]) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  const toggleWeekday = (day: number) =>
    setForm(prev => prev && ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day].sort((a, b) => a - b),
    }));

  const setPause = (index: number, patch: Partial<RecurrencePause>) =>
    setForm(prev => prev && ({
      ...prev,
      pauses: prev.pauses.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));

  const startCreate = () => { setEditId(null); setForm({ ...emptyForm }); };

  const startEdit = (s: RecurringSeries) => {
    setEditId(s.id);
    const { id: _id, ...rest } = s;
    setForm({ ...rest });
  };

  /** Adds the work orders that are missing for a series. */
  const generate = (s: RecurringSeries) => {
    const created = buildOrdersForSeries(s, orders);
    if (created.length === 0) {
      toast.info('All work orders for this series already exist.');
      return;
    }
    setOrders(prev => [...prev, ...created]);
    toast.success(`Created ${created.length} work order${created.length > 1 ? 's' : ''}.`);
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    if (!form.clientRef) { toast.error('Pick a customer.'); return; }
    if (form.weekdays.length === 0) { toast.error('Pick at least one weekday.'); return; }
    if (!form.seriesStart || !form.seriesEnd) { toast.error('Start and end date are required.'); return; }
    if (form.seriesEnd < form.seriesStart) { toast.error('The end date cannot be before the start date.'); return; }

    const clientName = sortedClients.find(c => c.id === form.clientRef)?.name ?? '';
    const payload: RecurringSeriesInput = {
      ...form,
      clientName,
      pauses: form.pauses.filter(p => p.from && p.to && p.to >= p.from),
    };

    setSaving(true);
    try {
      if (editId) {
        await updateRecurringSeries(editId, payload, clientRowId(form.clientRef));
        toast.success('Series updated. Existing work orders are untouched.');
      } else {
        const created = await createRecurringSeries(payload, clientRowId(form.clientRef));
        const newOrders = buildOrdersForSeries({ ...created, clientName }, orders);
        setOrders(prev => [...prev, ...newOrders]);
        toast.success(`Series created with ${newOrders.length} work orders.`);
      }
      setForm(null);
      setEditId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the series.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (removeFuture: boolean) => {
    if (!deleteTarget) return;
    try {
      if (removeFuture) {
        const toRemove = new Set(untouchedOccurrences(deleteTarget, orders).map(p => p.id));
        if (toRemove.size > 0) setOrders(prev => prev.filter(p => !toRemove.has(p.id)));
      }
      await deleteRecurringSeries(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
      toast.success('Series removed.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove the series.');
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Repeat className="w-5 h-5 text-primary" />
            Recurring orders
          </h1>
          <p className="text-sm text-muted-foreground">
            Standing work for the same customer — e.g. Wednesday to Friday every week. Each occurrence
            becomes a normal work order you plan, report and invoice on its own.
          </p>
        </div>
        <Button onClick={startCreate} className="gap-1.5">
          <Plus className="w-4 h-4" />
          New series
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr className="text-left">
              <th className="px-4 py-2 font-medium">Series</th>
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Days</th>
              <th className="px-4 py-2 font-medium">Period</th>
              <th className="px-4 py-2 font-medium">Work orders</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-6 text-muted-foreground">Loading…</td></tr>
            )}
            {!loading && series.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-muted-foreground">No recurring orders yet.</td></tr>
            )}
            {series.map(s => {
              const existing = ordersBySeries.get(s.id) ?? [];
              const missing = buildOrdersForSeries(s, orders).length;
              return (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium text-foreground">{s.name}</td>
                  <td className="px-4 py-2">{s.clientName ?? '—'}</td>
                  <td className="px-4 py-2">
                    {weekdayText(s.weekdays)}
                    {s.intervalWeeks > 1 && (
                      <span className="text-muted-foreground"> · every {s.intervalWeeks} weeks</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{s.seriesStart} → {s.seriesEnd}</td>
                  <td className="px-4 py-2">
                    {existing.length}
                    {missing > 0 && <span className="text-amber-600"> · {missing} missing</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {missing > 0 && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generate(s)}>
                          <CalendarClock className="w-3.5 h-3.5" />
                          Generate {missing}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => startEdit(s)} aria-label="Edit series">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(s)} aria-label="Delete series">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create / edit */}
      <Dialog open={!!form} onOpenChange={o => { if (!o) { setForm(null); setEditId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit recurring order' : 'New recurring order'}</DialogTitle>
            <DialogDescription>
              Occurrences are created as Open work orders without installers, so you staff them in Planning.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="MIAV" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Customer</Label>
                  <Select value={form.clientRef || undefined} onValueChange={v => set('clientRef', v)}>
                    <SelectTrigger><SelectValue placeholder="Pick a customer" /></SelectTrigger>
                    <SelectContent>
                      {sortedClients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Project (optional)</Label>
                  <Select
                    value={form.projectGroupId || 'none'}
                    onValueChange={v => set('projectGroupId', v === 'none' ? '' : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Order type</Label>
                  <Select value={form.projectType} onValueChange={v => set('projectType', v as ProjectType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="installation">Installation</SelectItem>
                      <SelectItem value="site-survey">Site Survey</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Location</Label>
                  <Input value={form.location ?? ''} onChange={e => set('location', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Street</Label>
                  <Input value={form.street ?? ''} onChange={e => set('street', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Postal code</Label>
                  <Input value={form.postalCode ?? ''} onChange={e => set('postalCode', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Region</Label>
                  <Input value={form.region ?? ''} onChange={e => set('region', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Start time</Label>
                  <Input type="time" value={form.startTime ?? ''} onChange={e => set('startTime', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>End time</Label>
                  <Input type="time" value={form.endTime ?? ''} onChange={e => set('endTime', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Estimated hours (total per occurrence)</Label>
                  <Input
                    type="number" min="0" step="0.5"
                    value={form.estimatedHours ?? ''}
                    onChange={e => set('estimatedHours', e.target.value ? Number(e.target.value) : undefined)}
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label>Work description</Label>
                <Textarea
                  rows={3}
                  value={form.description ?? ''}
                  onChange={e => set('description', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>Contact name</Label>
                  <Input value={form.contactName ?? ''} onChange={e => set('contactName', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Contact phone</Label>
                  <Input value={form.contactPhone ?? ''} onChange={e => set('contactPhone', e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Contact email</Label>
                  <Input value={form.contactEmail ?? ''} onChange={e => set('contactEmail', e.target.value)} />
                </div>
              </div>

              {/* Repeat rule */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="grid gap-1.5">
                  <Label>Repeats on</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map(w => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => toggleWeekday(w.value)}
                        className={cn(
                          'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
                          form.weekdays.includes(w.value)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:text-foreground',
                        )}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Interval</Label>
                    <Select
                      value={String(form.intervalWeeks)}
                      onValueChange={v => set('intervalWeeks', Number(v))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Every week</SelectItem>
                        <SelectItem value="2">Every other week</SelectItem>
                        <SelectItem value="3">Every 3 weeks</SelectItem>
                        <SelectItem value="4">Every 4 weeks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>First date</Label>
                    <Input type="date" value={form.seriesStart} onChange={e => set('seriesStart', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Last date</Label>
                    <Input type="date" value={form.seriesEnd} onChange={e => set('seriesEnd', e.target.value)} />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.skipHolidays}
                    onCheckedChange={v => set('skipHolidays', v === true)}
                  />
                  Skip Swedish public holidays (röda dagar)
                </label>

                <div className="space-y-2">
                  <Label>Paused periods</Label>
                  {form.pauses.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input type="date" value={p.from} onChange={e => setPause(i, { from: e.target.value })} />
                      <span className="text-muted-foreground text-sm">→</span>
                      <Input type="date" value={p.to} onChange={e => setPause(i, { to: e.target.value })} />
                      <Button
                        size="icon" variant="ghost" aria-label="Remove pause"
                        onClick={() => set('pauses', form.pauses.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="sm" variant="outline" className="gap-1.5"
                    onClick={() => set('pauses', [...form.pauses, { from: '', to: '' }])}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add paused period
                  </Button>
                </div>

                {preview && (
                  <p className="text-sm text-muted-foreground">
                    Creates <span className="font-medium text-foreground">{preview.dates.length}</span> work orders
                    {preview.skipped.length > 0 && <> · {preview.skipped.length} dates skipped</>}
                    {preview.dates.length > 0 && <> · first {preview.dates[0]}, last {preview.dates[preview.dates.length - 1]}</>}
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(null); setEditId(null); }}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save series'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              Work orders that are already planned, staffed or reported always stay. You can also remove the
              future occurrences that are still Open and unassigned
              {deleteTarget && ` (${untouchedOccurrences(deleteTarget, orders).length})`}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => confirmDelete(false)}>Keep work orders</Button>
            <Button variant="destructive" onClick={() => confirmDelete(true)}>Remove future occurrences</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecurringOrdersRegister;
