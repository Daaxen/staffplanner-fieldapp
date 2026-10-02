import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { onBookingConflict, type PendingBookingConflict } from '@/lib/appData';
import { OVERRIDE_REASON_MIN } from '@/lib/bookings';
import { useAuth } from '@/hooks/useAuth';

/** Shows a refused booking with its exact clash; admins may book anyway with a reason. */
export default function BookingConflictPrompt() {
  const { isAdmin } = useAuth();
  const [pending, setPending] = useState<PendingBookingConflict | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => onBookingConflict((c) => { setReason(''); setPending(c); }), []);

  const detail = pending?.message.replace(/\. En admin måste.*$/, '').replace(/^Bokningskrock:\s*/, '') ?? '';
  const valid = reason.trim().length >= OVERRIDE_REASON_MIN;

  const confirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await pending.retry(reason.trim());
      toast.success('Bokningen sparad med orsak (loggad)');
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Bokningskrock
          </DialogTitle>
          <DialogDescription>Ändringen sparades inte eftersom montören redan är upptagen.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 text-xs">
          {detail.split('; ').map((d, i) => (
            <li key={i} className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5">{d}</li>
          ))}
        </ul>
        {isAdmin && (
          <div className="grid gap-1.5">
            <Label htmlFor="conflict-reason">Orsak för att boka ändå *</Label>
            <Textarea id="conflict-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Varför är dubbelbokningen ok?" />
            <p className="text-xs text-muted-foreground">Minst {OVERRIDE_REASON_MIN} tecken. Sparas i loggen.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setPending(null)}>Stäng</Button>
          {isAdmin && (
            <Button variant="destructive" disabled={!valid || saving} onClick={confirm}>Boka ändå</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
