import { useMemo, useState } from 'react';
import { Clock, MapPin, Play, Square, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { expenseCategoryLabels, type ExpenseCategory } from '@/data/logsData';
import type { InstallerLogs } from '@/hooks/useInstallerLogs';
import { sumActualTime } from '@/lib/timeVariance';
import TimeVarianceCard from '@/components/installer/reporting/TimeVarianceCard';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProjectLogTabProps {
  projectId: string;
  logs: InstallerLogs;
  /** Estimated hours for the order, used for the deviation figure. */
  plannedHours?: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const money = (amount: number) => `${amount.toLocaleString('sv-SE')} SEK`;
const minutesToHours = (value: string) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
};

const ProjectLogTab = ({ projectId, logs, plannedHours }: ProjectLogTabProps) => {
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [travelMinutes, setTravelMinutes] = useState('');
  const [timeNote, setTimeNote] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutTravel, setCheckoutTravel] = useState('');
  const [km, setKm] = useState('');
  const [mileageNote, setMileageNote] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('materials');
  const [amount, setAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [saving, setSaving] = useState(false);

  const timeEntries = logs.timeFor(projectId);
  const expenseEntries = logs.expensesFor(projectId);
  const isThisTimer = logs.activeTimer?.projectId === projectId;
  const actual = useMemo(() => sumActualTime(timeEntries), [timeEntries]);
  const totals = useMemo(() => ({
    hours: actual.total,
    costs: expenseEntries.reduce((sum, entry) => sum + entry.amount, 0),
  }), [actual, expenseEntries]);

  const submitTime = async () => {
    if (!startTime || !endTime) {
      toast.error('Enter a start and finish time');
      return;
    }
    setSaving(true);
    const result = await logs.addTime({
      projectId, date, startTime, endTime,
      travelHours: minutesToHours(travelMinutes), note: timeNote,
    });
    setSaving(false);
    if (!result) { toast.error('Time could not be saved'); return; }
    setStartTime(''); setEndTime(''); setTravelMinutes(''); setTimeNote('');
    toast.success('Time saved');
  };

  const confirmCheckout = async () => {
    setSaving(true);
    await logs.stopTimer(minutesToHours(checkoutTravel));
    setSaving(false);
    setCheckoutOpen(false);
    setCheckoutTravel('');
    toast.success('Checked out');
  };

  const submitMileage = async () => {
    const distance = Number(km);
    if (!Number.isFinite(distance) || distance <= 0) {
      toast.error('Enter a valid distance');
      return;
    }
    setSaving(true);
    const result = await logs.addMileage(projectId, date, distance, undefined, mileageNote);
    setSaving(false);
    if (!result) { toast.error('Mileage could not be saved'); return; }
    setKm(''); setMileageNote('');
    toast.success('Mileage saved');
  };

  const submitExpense = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    const result = await logs.addExpense({ projectId, date, category, amount: value, note: expenseNote });
    setSaving(false);
    if (!result) { toast.error('Cost could not be saved'); return; }
    setAmount(''); setExpenseNote('');
    toast.success('Cost saved');
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <TimeVarianceCard plannedHours={plannedHours} actual={actual} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Reported time</p>
          <p className="text-xl font-bold text-foreground">{totals.hours.toFixed(1)} h</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Costs & mileage</p>
          <p className="text-xl font-bold text-foreground">{money(totals.costs)}</p>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold text-foreground">Check in / check out</h2><p className="text-xs text-muted-foreground">Start and finish time are saved automatically</p></div>
          {isThisTimer ? (
            <Button size="sm" variant="destructive" onClick={() => setCheckoutOpen(true)}><Square className="w-4 h-4 mr-1.5" />Check out</Button>
          ) : (
            <Button size="sm" disabled={Boolean(logs.activeTimer)} onClick={() => void logs.startTimer(projectId)}><Play className="w-4 h-4 mr-1.5" />Check in</Button>
          )}
        </div>
        {logs.activeTimer && !isThisTimer && <p className="text-xs text-muted-foreground">A timer is already running for another project.</p>}
      </section>

      <section className="rounded-lg border border-border bg-card p-3 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Clock className="w-4 h-4" />Add time manually</h2>
        <div><Label htmlFor="log-date">Date</Label><Input id="log-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="start-time">Start</Label><Input id="start-time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
          <div><Label htmlFor="end-time">Finish</Label><Input id="end-time" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
        </div>
        <div><Label htmlFor="travel-minutes">Travel time (minutes)</Label><Input id="travel-minutes" inputMode="numeric" type="number" min="0" step="5" placeholder="0" value={travelMinutes} onChange={e => setTravelMinutes(e.target.value)} /></div>
        <Textarea aria-label="Time note" placeholder="Note (optional)" value={timeNote} onChange={e => setTimeNote(e.target.value)} />
        <Button className="w-full" disabled={saving} onClick={() => void submitTime()}>Save time</Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-3 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><MapPin className="w-4 h-4" />Mileage</h2>
        <div><Label htmlFor="mileage">Distance (km)</Label><Input id="mileage" inputMode="decimal" type="number" min="0" step="0.1" value={km} onChange={e => setKm(e.target.value)} /></div>
        <Textarea aria-label="Mileage note" placeholder="Route or note (optional)" value={mileageNote} onChange={e => setMileageNote(e.target.value)} />
        <Button variant="outline" className="w-full" disabled={saving} onClick={() => void submitMileage()}>Save mileage</Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-3 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4" />Cost</h2>
        <div><Label>Category</Label><Select value={category} onValueChange={value => setCategory(value as ExpenseCategory)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{logs.categories.map(item => <SelectItem key={item} value={item}>{expenseCategoryLabels[item]}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="cost-amount">Amount (SEK)</Label><Input id="cost-amount" inputMode="decimal" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <Textarea aria-label="Cost note" placeholder="What was purchased?" value={expenseNote} onChange={e => setExpenseNote(e.target.value)} />
        <Button variant="outline" className="w-full" disabled={saving} onClick={() => void submitExpense()}>Save cost</Button>
      </section>

      {(timeEntries.length > 0 || expenseEntries.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Reported entries</h2>
          {timeEntries.map(entry => <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"><Clock className="w-4 h-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{entry.hours.toFixed(2)} h{entry.travelHours ? ` + ${entry.travelHours.toFixed(2)} h travel` : ''}</p><p className="text-xs text-muted-foreground">{entry.date}{entry.startTime ? ` · ${entry.startTime}–${entry.endTime}` : ''}</p></div><Button variant="ghost" size="icon" aria-label="Delete time entry" onClick={() => void logs.deleteTime(entry.id)}><Trash2 className="w-4 h-4" /></Button></div>)}
          {expenseEntries.map(entry => <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"><Wallet className="w-4 h-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{expenseCategoryLabels[entry.category]} · {money(entry.amount)}</p><p className="text-xs text-muted-foreground">{entry.date}{entry.km ? ` · ${entry.km} km` : ''}</p></div><Button variant="ghost" size="icon" aria-label="Delete cost entry" onClick={() => void logs.deleteExpense(entry.id)}><Trash2 className="w-4 h-4" /></Button></div>)}
        </section>
      )}

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check out</DialogTitle>
            <DialogDescription>
              Start time, finish time and work time are saved automatically. Add your travel time for this job.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="checkout-travel">Travel time (minutes)</Label>
            <Input id="checkout-travel" inputMode="numeric" type="number" min="0" step="5" placeholder="0" value={checkoutTravel} onChange={e => setCheckoutTravel(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={() => void confirmCheckout()}>Save and check out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectLogTab;