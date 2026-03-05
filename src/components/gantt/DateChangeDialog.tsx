import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DateChangeDialogProps {
  open: boolean;
  isMultiInstaller: boolean;
  onConfirmAll: () => void;
  onConfirmOne: () => void;
  onCancel: () => void;
}

const DateChangeDialog = ({ open, isMultiInstaller, onConfirmAll, onConfirmOne, onCancel }: DateChangeDialogProps) => {
  const [step, setStep] = useState<'confirm' | 'installer-choice'>('confirm');

  useEffect(() => {
    if (open) setStep('confirm');
  }, [open]);

  const handleConfirm = () => {
    if (isMultiInstaller) {
      setStep('installer-choice');
    } else {
      onConfirmAll();
    }
  };

  const handleCancel = () => {
    setStep('confirm');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <DialogContent className="sm:max-w-md">
        {step === 'confirm' ? (
          <>
            <DialogHeader>
              <DialogTitle>Change Dates</DialogTitle>
              <DialogDescription>Are you sure you want to change dates?</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleCancel}
              >
                Ops..
              </Button>
              <Button
                className="bg-status-completed text-primary-foreground hover:bg-status-completed/90"
                onClick={handleConfirm}
              >
                Yes
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Multiple Installers</DialogTitle>
              <DialogDescription>
                This project is assigned to multiple installers. Move all bars or only for this installer?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={handleCancel}>Cancel</Button>
              <Button variant="secondary" onClick={() => { onConfirmOne(); }}>
                Only this installer
              </Button>
              <Button
                className="bg-status-completed text-primary-foreground hover:bg-status-completed/90"
                onClick={() => { onConfirmAll(); }}
              >
                Move all bars
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DateChangeDialog;
