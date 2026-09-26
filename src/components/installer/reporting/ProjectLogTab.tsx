import { useMemo, useRef, useState } from 'react';
import { Camera, Clock, MapPin, Paperclip, Play, Receipt, Square, Trash2, Wallet, X } from 'lucide-react';
import { missingReceiptMessage, receiptRequired, uploadReceipt, RECEIPT_ACCEPT } from '@/lib/receipts';
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
import { hoursBetween, timeMismatchMessage } from '@/lib/validation/reporting';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProjectLogTabProps {
  projectId: string;
  logs: InstallerLogs;
  /** Estimated hours for the order, used for the deviation figure. */
  plannedHours?: number;
  startDate?: string;
  endDate?: string;
}

const pad = (n: number) => n.toString().padStart(2, '0');
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoLocal(new Date());
const money = (amount: number) => `${amount.toLocaleString('sv-SE')} SEK`;
/** Parses travel time in hours; accepts comma or dot. */
const parseHours = (value: string) => {
  const hours = Number(value.replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(12, Math.round(hours * 100) / 100);
};
const fmtH = (h: number) => h.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
const WEEKDAYS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

const orderDays = (start?: string, end?: string) => {
  if (!start) return [] as string[];
  const s = new Date(`${start.slice(0, 10)}T12:00:00`);
  const e = new Date(`${(end || start).slice(0, 10)}T12:00:00`);
  const out: string[] = [];
  for (let d = new Date(s); d <= e && out.length < 14; d.setDate(d.getDate() + 1)) out.push(isoLocal(d));
  return out;
};

const TravelQuick = ({ onPick }: { onPick: (v: string) => void }) => (
  <div className="flex gap-2 mt-2">
    {['0,5', '1', '1,5', '2'].map(v => (
      <Button key={v} type="button" size="sm" variant="outline" className="flex-1" onClick={() => onPick(v)}>{v} h</Button>
    ))}
  </div>
);

const ProjectLogTab = ({ projectId, logs, plannedHours, startDate, endDate }: ProjectLogTabProps) => {
  const [date, setDate] = useState(today);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hoursInput, setHoursInput] = useState('');
  const [travelHoursInput, setTravelHoursInput] = useState('');
  const [timeNote, setTimeNote] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutTravel, setCheckoutTravel] = useState('');
  const [otherDay, setOtherDay] = useState(false);
  const [km, setKm] = useState('');
  const [mileageNote, setMileageNote] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('materials');
  const [amount, setAmount] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [receiptPath, setReceiptPath] = useState('');
  const [receiptLabel, setReceiptLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const timeEntries = logs.timeFor(projectId);
  const expenseEntries = logs.expensesFor(projectId);
  const isThisTimer = logs.activeTimer?.projectId === projectId;
  const actual = useMemo(() => sumActualTime(timeEntries), [timeEntries]);
  const totals = useMemo(() => ({
    hours: actual.total,
    costs: expenseEntries.reduce((sum, entry) => sum + entry.amount, 0),
  }), [actual, expenseEntries]);

  const computedHours = startTime && endTime ? hoursBetween(startTime, endTime) : null;
  const statedHours = hoursInput.trim() ? Number(hoursInput.replace(',', '.')) : undefined;

  const saveTime = async (acceptComputed: boolean) => {
    setSaving(true);
    const result = await logs.addTime({
      projectId, date, startTime, endTime,
      hours: acceptComputed ? undefined : (Number.isFinite(statedHours) ? statedHours : undefined),
      acceptComputed,
      travelHours: minutesToHours(travelMinutes), note: timeNote,
    });
    setSaving(false);
    if (!result) return false;
    setStartTime(''); setEndTime(''); setHoursInput(''); setTravelMinutes(''); setTimeNote('');
    toast.success('Tiden är sparad');
    return true;
  };

  const submitTime = async () => {
    if (!startTime || !endTime) {
      toast.error('Ange start- och sluttid');
      return;
    }
    await saveTime(false);
  };

  const acceptComputed = async () => {
    logs.clearMismatch();
    await saveTime(true);
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

  const pickReceipt = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    const result = await uploadReceipt(file);
    setUploading(false);
    if ('error' in result) { toast.error(result.error); return; }
    setReceiptPath(result.path);
    setReceiptLabel(file.name);
    toast.success('Kvitto bifogat');
  };

  const submitExpense = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Ange ett giltigt belopp');
      return;
    }
    if (receiptRequired(category, value) && !receiptPath) {
      toast.error(missingReceiptMessage(category));
      return;
    }
    setSaving(true);
    const result = await logs.addExpense({
      projectId, date, category, amount: value, note: expenseNote, receiptName: receiptPath || undefined,
    });
    setSaving(false);
    if (!result) { toast.error('Kostnaden kunde inte sparas'); return; }
    setAmount(''); setExpenseNote(''); setReceiptPath(''); setReceiptLabel('');
    toast.success('Kostnad sparad');
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
        <div>
          <Label htmlFor="stated-hours">Timmar (valfritt)</Label>
          <Input id="stated-hours" inputMode="decimal" type="number" min="0" step="0.25"
            placeholder={computedHours != null ? computedHours.toFixed(2) : '0'}
            value={hoursInput} onChange={e => setHoursInput(e.target.value)} />
          {computedHours != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Tiderna ger {computedHours.toFixed(2).replace('.', ',')} h. Lämnas fältet tomt sparas den beräknade tiden.
            </p>
          )}
        </div>
        <div><Label htmlFor="travel-minutes">Travel time (minutes)</Label><Input id="travel-minutes" inputMode="numeric" type="number" min="0" step="5" placeholder="0" value={travelMinutes} onChange={e => setTravelMinutes(e.target.value)} /></div>
        <Textarea aria-label="Time note" placeholder="Note (optional)" value={timeNote} onChange={e => setTimeNote(e.target.value)} />
        <Button className="w-full" disabled={saving} onClick={() => void submitTime()}>Save time</Button>
      </section>

      <Dialog open={Boolean(logs.pendingMismatch)} onOpenChange={open => { if (!open) logs.clearMismatch(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tiderna stämmer inte med timmarna</DialogTitle>
            <DialogDescription>
              {logs.pendingMismatch ? timeMismatchMessage(logs.pendingMismatch) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => logs.clearMismatch()}>Ändra tiderna</Button>
            <Button disabled={saving} onClick={() => void acceptComputed()}>
              Godkänn {logs.pendingMismatch ? logs.pendingMismatch.computed.toFixed(2).replace('.', ',') : ''} h
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

        <div className="space-y-2">
          <Label>Kvitto{receiptRequired(category, Number(amount) || 0) ? ' *' : ''}</Label>
          {receiptPath ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
              <Receipt className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground truncate flex-1">{receiptLabel}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Ta bort kvitto"
                onClick={() => { setReceiptPath(''); setReceiptLabel(''); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={uploading} onClick={() => cameraInput.current?.click()}>
                <Camera className="w-4 h-4 mr-1.5" />Fota kvitto
              </Button>
              <Button variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                <Paperclip className="w-4 h-4 mr-1.5" />Bifoga fil
              </Button>
            </div>
          )}
          {!receiptPath && receiptRequired(category, Number(amount) || 0) && (
            <p className="text-xs text-destructive">{missingReceiptMessage(category)}</p>
          )}
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            aria-label="Fota kvitto"
            onChange={e => { void pickReceipt(e.target.files?.[0]); e.target.value = ''; }}
          />
          <input
            ref={fileInput}
            type="file"
            accept={RECEIPT_ACCEPT}
            className="hidden"
            aria-label="Bifoga kvitto"
            onChange={e => { void pickReceipt(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>

        <Button variant="outline" className="w-full" disabled={saving || uploading} onClick={() => void submitExpense()}>Save cost</Button>
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