import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DurationWheel, TimeWheel } from '@/components/ui/time-wheel';
import { computeHours } from '@/data/logsData';
import type { InstallerLogs } from '@/hooks/useInstallerLogs';

export interface EditableTimeEntry {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  travelHours?: number;
}

/** Parses travel time in hours; accepts comma or dot. */
export const parseHours = (value: string) => {
  const hours = Number(value.replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(12, Math.round(hours * 100) / 100);
};

export const fmtH = (h: number) => h.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');

interface EditTimeDialogProps {
  logs: InstallerLogs;
  entry: EditableTimeEntry | null;
  onClose: () => void;
}

/** Shared dialog for correcting a saved time entry (start/end wheels + travel wheel). */
const EditTimeDialog = ({ logs, entry, onClose }: EditTimeDialogProps) => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [travel, setTravel] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (entry && loadedFor !== entry.id) {
    setLoadedFor(entry.id);
    setStart(entry.startTime?.slice(0, 5) ?? '');
    setEnd(entry.endTime?.slice(0, 5) ?? '');
    setTravel(entry.travelHours ? fmtH(entry.travelHours) : '');
  }

  const hours = start && end ? computeHours(start, end) : 0;

  const save = async () => {
    if (!entry) return;
    setSaving(true);
    const ok = await logs.updateTime(entry.id, { startTime: start, endTime: end, travelHours: parseHours(travel) });
    setSaving(false);
    if (ok) { onClose(); toast.success('Tiden är ändrad'); }
  };

  return (
    <Dialog open={Boolean(entry)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ändra tid {entry?.date}</DialogTitle>
          <DialogDescription>Arbetstiden räknas fram från start och slut.</DialogDescription>
        </DialogHeader>
        {entry && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TimeWheel id="edit-start" label="Start" value={start} fallback="07:00" onChange={setStart} />
              <TimeWheel id="edit-end" label="Slut" value={end} fallback="16:00" onChange={setEnd} />
            </div>
            <p className="text-sm text-foreground">Arbetstid: <span className="font-semibold">{fmtH(hours) || '0'} h</span></p>
            <DurationWheel id="edit-travel" label="Restid totalt (tur och retur)" hint="All restid för dagen, båda hållen" value={parseHours(travel)} onChange={h => setTravel(h ? fmtH(h) : '')} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Avbryt</Button>
          <Button disabled={saving || hours <= 0} onClick={() => void save()}>Spara ändring</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTimeDialog;
