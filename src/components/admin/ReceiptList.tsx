import { useState } from 'react';
import { ExternalLink, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { sek } from '@/lib/profitability';
import { receiptFileName, receiptUrl } from '@/lib/receipts';
import type { ProjectReceipt } from '@/hooks/useProjectReceipts';

/** Receipts attached to an order's expenses, opened through short-lived links. */
const ReceiptList = ({ receipts }: { receipts: ProjectReceipt[] }) => {
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (r: ProjectReceipt) => {
    setOpening(r.id);
    const url = await receiptUrl(r.path);
    setOpening(null);
    if (!url) { toast.error('Kvittot kunde inte öppnas — du saknar behörighet eller filen saknas.'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      <div className="text-sm font-medium mb-2">Kvitton ({receipts.length})</div>
      {receipts.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga kvitton är bifogade på den här ordern.</p>
      ) : (
        <ul className="space-y-1">
          {receipts.map(r => (
            <li key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs">
              <Receipt className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">
                {r.date} · {r.category} · {sek(r.amount)}
                {r.note ? ` · ${r.note}` : ''}
                <span className="block text-muted-foreground truncate">{receiptFileName(r.path)}</span>
              </span>
              <Button size="sm" variant="outline" disabled={opening === r.id} onClick={() => void open(r)}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" />Öppna
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReceiptList;
