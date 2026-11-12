import { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReportingRateRow, RateTone } from '@/lib/timeReporting';

const bar: Record<RateTone, string> = { green: 'bg-status-completed', yellow: 'bg-status-in-progress', red: 'bg-destructive' };
const dot = bar;
const KEY = 'fetch.reportingRate.open';
const h = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });

export default function ReportingRateCard({ rows, selected, onSelect }: { rows: ReportingRateRow[]; selected?: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) !== '0');
  const toggle = () => setOpen(o => { localStorage.setItem(KEY, o ? '0' : '1'); return !o; });
  const avail = rows.reduce((s, r) => s + r.available, 0), rep = rows.reduce((s, r) => s + r.reported, 0);
  const avg = avail > 0 ? Math.round((rep / avail) * 100) : 0;
  const count = (t: RateTone) => rows.filter(r => r.tone === t).length;
  return (
    <div className="rounded-md border border-border bg-card">
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full flex items-center gap-3 p-3 text-left">
        <BarChart3 className="w-5 h-5 text-primary" />
        <span className="font-semibold">Rapporteringsgrad</span>
        <span className="text-sm text-muted-foreground">Snitt teamet</span>
        <span className="text-xl font-bold">{avg} %</span>
        <span className="hidden sm:flex items-center gap-3 text-sm ml-2">
          {(['green', 'yellow', 'red'] as RateTone[]).map(t => (
            <span key={t} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 rounded-full ${dot[t]}`} />{count(t)}</span>
          ))}
        </span>
        <span className="ml-auto"><Button asChild variant="outline" size="sm"><span>{open ? <>Dölj <ChevronUp className="w-4 h-4 ml-1" /></> : <>Visa <ChevronDown className="w-4 h-4 ml-1" /></>}</span></Button></span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {rows.length === 0 && <div className="text-sm text-muted-foreground py-2">Ingen tillgänglig tid i perioden.</div>}
          {rows.map(r => (
            <button key={r.id} type="button" onClick={() => onSelect(r.id)}
              className={`w-full grid grid-cols-[10rem_7rem_1fr_auto_3.5rem] items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-muted ${selected === r.id ? 'bg-muted' : ''}`}>
              <span className="font-semibold truncate text-left">{r.name}</span>
              <span className="tabular-nums text-muted-foreground">{h(r.reported)} / {h(r.available)} h</span>
              <span className="flex flex-col gap-0.5">
                <span className="h-2.5 rounded-full bg-muted overflow-hidden" title="Arbetstid"><span className={`block h-full ${bar[r.tone]}`} style={{ width: `${Math.min(r.pct, 100)}%` }} /></span>
                <span className="h-1.5 rounded-full bg-muted overflow-hidden" title="Restid"><span className="block h-full bg-travel" style={{ width: `${r.available > 0 ? Math.min((r.travel / r.available) * 100, 100) : 0}%` }} /></span>
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{r.absenceDays > 0 ? `${r.absenceDays} dag frånvaro · ` : ''}<span className="text-travel font-medium">restid {h(r.travel)} h</span></span>
              <span className="font-bold tabular-nums text-right">{r.pct} %</span>
            </button>
          ))}
          <div className="flex gap-4 text-xs text-muted-foreground pt-2">
            <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${dot.green}`} />≥ 90 %</span>
            <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${dot.yellow}`} />60–89 %</span>
            <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${dot.red}`} />&lt; 60 %</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-travel" />Restid</span>
            <span>Tillgänglig tid = vardagar × 8 h minus frånvaro</span>
          </div>
        </div>
      )}
    </div>
  );
}
