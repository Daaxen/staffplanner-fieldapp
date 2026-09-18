import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { OVERRIDE_REASON_MIN, type BookingConflict } from '@/lib/bookings';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: BookingConflict[];
  installerName: (id: string) => string;
  onConfirm: (reason: string) => void;
}

export default function BookingOverrideDialog({
  open, onOpenChange, conflicts, installerName, onConfirm,
}: Props) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= OVERRIDE_REASON_MIN;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setReason(''); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Booking conflict
          </DialogTitle>
          <DialogDescription>
            This booking overlaps existing work or a planned absence. As an admin you may
            override it, but a written reason is required and stored in the audit log.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1 text-xs">
          {conflicts.map((c, i) => (
            <li key={i} className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5">
              <span className="font-medium">{installerName(c.installerId)}</span> — {c.detail}
              <span className="text-muted-foreground"> ({c.from.slice(0, 10)} → {c.to.slice(0, 10)})</span>
            </li>
          ))}
        </ul>

        <div className="grid gap-1.5">
          <Label htmlFor="override-reason">Reason for override *</Label>
          <Textarea
            id="override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this double booking acceptable?"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            At least {OVERRIDE_REASON_MIN} characters.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!valid}
            onClick={() => { onConfirm(reason.trim()); setReason(''); }}
          >
            Override and save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
