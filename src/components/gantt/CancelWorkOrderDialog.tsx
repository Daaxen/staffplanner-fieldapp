import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names of the work order(s) being cancelled. */
  orderNames: string[];
  /** Number of assigned installers that will be released. */
  affectedInstallers: number;
  onConfirm: (reason: string) => void;
}

/**
 * Confirmation for cancelling one or more work orders. The optional reason is
 * appended to the order's description so it survives in history and reports.
 */
const CancelWorkOrderDialog = ({ open, onOpenChange, orderNames, affectedInstallers, onConfirm }: Props) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const handleConfirm = () => {
    onConfirm(reason.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Cancel {orderNames.length === 1 ? 'work order' : `${orderNames.length} work orders`}
          </DialogTitle>
          <DialogDescription>
            {orderNames.length === 1
              ? `"${orderNames[0]}" will be marked as Cancelled.`
              : `${orderNames.length} work orders will be marked as Cancelled.`}
            {affectedInstallers > 0 &&
              ` ${affectedInstallers} assigned installer${affectedInstallers === 1 ? '' : 's'} will be released and notified.`}
            {' '}The order stays in the register and history — it is never deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            maxLength={500}
            placeholder="e.g. Customer postponed the installation"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep order</Button>
          <Button variant="destructive" onClick={handleConfirm}>
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Cancel work order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancelWorkOrderDialog;
