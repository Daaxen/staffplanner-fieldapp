import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { receiptPathsOf, receiptUrl } from '@/lib/receipts';
import type { CostEntry } from '@/lib/timeReporting';

const CAT: Record<string, string> = { materials: 'Material', travel: 'Resa', parking: 'Parkering', meal: 'Måltid', mileage: 'Milersättning', accommodation: 'Logi (hotell)', other: 'Övrigt' };
const DAY: Record<string, string> = { full: 'Heldag', half: 'Halvdag', departure: 'Avresedag', return: 'Hemresedag' };
const kr = (n: unknown) => Number(n || 0).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TITLE = { expense: 'Utlägg', mileage: 'Mil', perDiem: 'Traktamente' };

async function openReceipt(path: string) {
  const url = await receiptUrl(path);
  if (url) window.open(url, '_blank', 'noopener');
}

function describe(kind: keyof typeof TITLE, c: CostEntry): { main: string; sub?: string } {
  const note = c.note ? String(c.note) : undefined;
  if (kind === 'expense') return { main: CAT[String(c.category)] ?? String(c.category ?? 'Utlägg'), sub: note };
  if (kind === 'mileage') return { main: `${kr(c.km).replace(',00', '')} km${c.rate ? ` × ${kr(c.rate)} kr` : ''}`, sub: note };
  const meals = [c.breakfast_provided && 'frukost', c.lunch_provided && 'lunch', c.dinner_provided && 'middag'].filter(Boolean);
  const country = String(c.country ?? 'Sverige');
  return {
    main: `${DAY[String(c.day_type)] ?? String(c.day_type ?? '')} · ${country === 'Sverige' ? 'inrikes' : `utrikes (${country})`}${c.overnight ? ' · natt' : ''}`,
    sub: [meals.length ? `Betald måltid: ${meals.join(', ')}` : '', note].filter(Boolean).join(' · ') || undefined,
  };
}

/** Clickable cost amount that shows which entries make up the total. */
export default function CostBreakdownPopover({ kind, items, total, label }: { kind: keyof typeof TITLE; items: CostEntry[]; total: number; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="tabular-nums underline decoration-dotted underline-offset-2 hover:text-primary">{label}</button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 text-left">
        <p className="mb-2 text-sm font-semibold">{TITLE[kind]} · {items.length} {items.length === 1 ? 'post' : 'poster'}</p>
        <ul className="space-y-2">
          {items.map((c, i) => {
            const d = describe(kind, c);
            const receipts = kind === 'expense' ? receiptPathsOf(c as { receipt_path?: string | null; receipt_paths?: unknown }) : [];
            return (
              <li key={String(c.id ?? i)} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{d.main}</p>
                  {d.sub && <p className="text-xs text-muted-foreground break-words">{d.sub}</p>}
                  {receipts.map((p, j) => (
                    <button key={p} type="button" onClick={() => openReceipt(p)} className="mr-2 text-xs text-primary underline">
                      Visa kvitto{receipts.length > 1 ? ` ${j + 1}` : ''}
                    </button>
                  ))}
                </div>
                <span className="whitespace-nowrap tabular-nums">{kr(c.amount)} kr</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
          <span>Summa</span><span className="tabular-nums">{kr(total)} kr</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
