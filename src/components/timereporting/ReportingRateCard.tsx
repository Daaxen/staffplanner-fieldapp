import { useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, Users } from 'lucide-react';
import type { ReportingRateRow, RateTone } from '@/lib/timeReporting';
import { rateTone } from '@/lib/timeReporting';

const bar: Record<RateTone, string> = { green: 'bg-status-completed', yellow: 'bg-status-in-progress', red: 'bg-destructive' };
const KEY = 'fetch.reportingRate.open';
const h = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });
const GRID = 'grid grid-cols-[10rem_1fr_6.5rem_3.5rem_minmax(6rem,0.6fr)_3.5rem] items-center gap-3';

function Bar({ pct, cls, thin }: { pct: number; cls: string; thin?: boolean }) {
  return <span className={`${thin ? 'h-2' : 'h-2.5'} rounded-full bg-muted overflow-hidden`}><span className={`block h-full ${cls}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} /></span>;
}

export default function ReportingRateCard({ rows, selected, onSelect }: { rows: ReportingRateRow[]; selected?: string; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) !== '0');
  const toggle = () => setOpen(o => { localStorage.setItem(KEY, o ? '0' : '1'); return !o; });
  const avail = rows.reduce((s, r) => s + r.available, 0), rep = rows.reduce((s, r) => s + r.reported, 0);
  const travel = rows.reduce((s, r) => s + r.travel, 0);
  const avg = avail > 0 ? Math.round((rep / avail) * 100) : 0;
  const maxTravel = Math.max(1, ...rows.map(r => r.travel));
  return (
    <div className="rounded-md border border-border bg-card">
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full flex flex-wrap items-center gap-3 p-3 text-left">
        <BarChart3 className="w-5 h-5 text-primary" />
        <span className="font-semibold">Rapporteringsgrad</span>
        {!open && <span className="text-sm">Arbetstid <b>{avg} %</b> · <span className="text-travel">Restid <b>{h(travel)} h</b></span></span>}
        <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">{open ? <>Dölj <ChevronUp className="w-4 h-4" /></> : <>Visa <ChevronDown className="w-4 h-4" /></>}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <div className={`${GRID} px-2 pb-1 text-xs font-semibold text-muted-foreground`}>
            <span /><span>Arbetstid</span><span /><span /><span className="text-travel">Restid</span><span />
          </div>
          {rows.length === 0 && <div className="text-sm text-muted-foreground py-2 px-2">Ingen tillgänglig tid i perioden.</div>}
          {rows.map(r => (
            <button key={r.id} type="button" onClick={() => onSelect(r.id)}
              className={`w-full ${GRID} rounded px-2 py-1.5 text-sm hover:bg-muted ${selected === r.id ? 'bg-muted' : ''}`}>
              <span className="text-left truncate"><span className="font-semibold">{r.name}</span>{r.absenceDays > 0 && <span className="block text-xs text-muted-foreground">{r.absenceDays} dag frånvaro</span>}</span>
              <Bar pct={r.pct} cls={bar[r.tone]} />
              <span className="tabular-nums text-muted-foreground text-right">{h(r.reported)} / {h(r.available)} h</span>
              <span className="font-bold tabular-nums text-right">{r.pct} %</span>
              <Bar pct={(r.travel / maxTravel) * 100} cls="bg-travel" thin />
              <span className="tabular-nums text-right">{h(r.travel)} h</span>
            </button>
          ))}
          {rows.length > 0 && (
            <div className={`${GRID} border-t border-border mt-1 px-2 pt-2 text-sm`}>
              <span className="flex items-center gap-2 font-bold"><Users className="w-4 h-4" />Teamet</span>
              <Bar pct={avg} cls={bar[rateTone(avg)]} />
              <span className="tabular-nums font-semibold text-right">{h(rep)} / {h(avail)} h</span>
              <span className="font-bold tabular-nums text-right">{avg} %</span>
              <span />
              <span className="tabular-nums font-bold text-right text-travel">{h(travel)} h</span>
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-3 px-2">
            <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${bar.green}`} />≥ 90 %</span>
            <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${bar.yellow}`} />60–89 %</span>
            <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${bar.red}`} />&lt; 60 %</span>
            <span>Arbetstid mot vardagar × 8 h minus frånvaro · restid redovisas separat</span>
          </div>
        </div>
      )}
    </div>
  );
}
