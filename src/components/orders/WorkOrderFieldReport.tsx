import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardCheck, Image as ImageIcon, AlertTriangle, Receipt } from 'lucide-react';
import { ExpandableText } from '@/components/ui/expandable-text';
import { workOrderBillables } from '@/lib/workOrderBillables';
import { receiptUrl, receiptPathsOf } from '@/lib/receipts';
import { exportFieldReportPdf, exportFieldReportXlsx, loadFieldReportData, type FieldReportData } from '@/lib/fieldReportExport';
import { Button } from '@/components/ui/button';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { usePerDiemEntries } from '@/hooks/usePerDiem';

const kr = (n: number) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr`;
type Any = Record<string, any>;

export default function WorkOrderFieldReport({ projectId, orderName }: { projectId: string; orderName: string }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [d, setD] = useState<FieldReportData | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const { entries: perDiem } = usePerDiemEntries(projectId);

  useEffect(() => {
    let alive = true;
    loadFieldReportData([projectId]).then(([data]) => { if (alive) setD(data); });
    return () => { alive = false; };
  }, [projectId]);

  if (!d) return <div className="pt-4 border-t border-border text-sm text-muted-foreground">Loading field report…</div>;
  const b = workOrderBillables(d.time as any, d.mil as any, d.exp as any, d.order, d.client);
  const installerIds = Object.keys(b.perInstaller).concat(d.reports.map(r => r.installer_id)).filter((v, i, a) => a.indexOf(v) === i);
  const name = (id: string) => d.names[id] ?? 'Unknown';
  const Photos = ({ paths }: { paths: string[] }) => paths?.length ? (
    <div className="flex flex-wrap gap-2 mt-2">{paths.map(p => d.photos[p] && <img key={p} src={d.photos[p]} onClick={() => setZoom(d.photos[p])} className="w-16 h-16 object-cover rounded cursor-pointer border border-border" alt="" />)}</div>
  ) : null;

  return (
    <div className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> Field report</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={pdfBusy} onClick={async () => { setPdfBusy(true); try { await exportFieldReportPdf({ ...d, orderName }); } finally { setPdfBusy(false); } }}><FileDown className="w-4 h-4" />{pdfBusy ? 'Skapar…' : 'PDF'}</Button>
          <Button size="sm" variant="outline" onClick={() => exportFieldReportXlsx({ ...d, orderName })}><FileSpreadsheet className="w-4 h-4" />Excel</Button>
        </div>
      </div>
      {installerIds.length === 0 && d.dev.length === 0 && <p className="text-sm text-muted-foreground">Nothing reported yet.</p>}

      {installerIds.map(id => {
        const rep = d.reports.find(r => r.installer_id === id);
        const rows = d.time.filter(t => t.installer_id === id);
        const checked = Array.isArray(rep?.checked_items) ? rep.checked_items.length : Object.values(rep?.checked_items ?? {}).filter(Boolean).length;
        const signs = Object.keys(rep?.sign_offs ?? {}).length;
        return (
          <div key={id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm font-bold">{name(id)}</p>
              {rep && <span className={rep.submitted_at ? 'text-xs font-semibold text-status-completed' : 'text-xs font-semibold text-status-in-progress'}>
                {rep.submitted_at ? `Submitted ${new Date(rep.submitted_at).toLocaleString('sv-SE')}` : 'Not submitted'}
              </span>}
            </div>
            {rep?.report_text ? <ExpandableText text={rep.report_text} className="text-sm" /> : <p className="text-xs text-muted-foreground">No written report.</p>}
            {rep && <p className="text-xs text-muted-foreground">Checklist: {checked} checked · Sign-offs: {signs}{rep.signature ? ' · Customer signature ✓' : ''}</p>}
            {rep && <Photos paths={rep.photo_paths ?? []} />}
            {rows.some(r => r.description || r.note) && (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-semibold text-muted-foreground">Time comments</p>
                {rows.filter(r => r.description || r.note).map((r, i) => (
                  <div key={i} className="text-sm flex gap-2"><span className="text-xs text-muted-foreground w-20 shrink-0">{r.entry_date}</span><ExpandableText text={r.description || r.note} className="min-w-0 flex-1" /></div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {d.dev.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Deviations</p>
          {d.dev.map(x => (
            <div key={x.id} className="rounded-lg border border-destructive/40 p-2 text-sm">
              <p className="font-semibold">{x.category} · {x.severity} · {name(x.installer_id)}</p>
              <ExpandableText text={x.description} />
              <Photos paths={x.photo_paths ?? []} />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-3 space-y-2">
        <p className="text-sm font-bold flex items-center gap-2"><Receipt className="w-4 h-4" /> Billables</p>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground text-left"><th>Installer</th><th className="text-right">Work</th><th className="text-right">Travel</th><th className="text-right">Mileage</th><th className="text-right">Expenses</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {Object.entries(b.perInstaller).map(([id, l]) => (
              <tr key={id} className="border-t border-border"><td>{name(id)}</td><td className="text-right">{l.workHours} h · {kr(l.workAmount)}</td><td className="text-right">{l.travelHours} h</td><td className="text-right">{l.km} km · {kr(l.mileageAmount)}</td><td className="text-right">{kr(l.expenseAmount)}</td><td className="text-right font-semibold">{kr(l.total)}</td></tr>
            ))}
            <tr className="border-t-2 border-border font-bold"><td>Total</td><td className="text-right">{b.total.workHours} h · {kr(b.total.workAmount)}</td><td className="text-right">{b.total.travelHours} h</td><td className="text-right">{b.total.km} km · {kr(b.total.mileageAmount)}</td><td className="text-right">{kr(b.total.expenseAmount)}</td><td className="text-right">{kr(b.total.total)}</td></tr>
          </tbody>
        </table>
        {perDiem.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Traktamente (skattefritt) · totalt {kr(perDiem.reduce((s, e) => s + Number(e.amount), 0))}</p>
            {perDiem.map(e => (
              <p key={e.id} className="text-xs">{e.entry_date} · {name(e.installer_id)} · {e.country} · {e.day_type === 'full' ? 'Heldag' : e.day_type === 'half' ? 'Halvdag' : 'Ingen dag'}{e.overnight === 'private' ? ' + natt' : e.overnight === 'hotel' ? ' · hotell' : ''} · <span className="font-semibold">{kr(Number(e.amount))}</span></p>
            ))}
          </div>
        )}
        {b.total.unpricedRows > 0 && <p className="text-xs font-semibold text-destructive">{b.total.unpricedRows} time rows have no hourly rate and are not priced.</p>}
        {d.exp.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Expenses</p>
            {d.exp.map((x, i) => (
              <div key={i} className="text-xs flex justify-between gap-2">
                <span>{x.entry_date} · {x.category} · {name(x.installer_id)}</span>
                <span className="flex gap-2">{kr(Number(x.amount))}{receiptPathsOf(x).map((rp, ri, all) => <button key={rp} className="text-primary hover:underline" onClick={async () => { const u = await receiptUrl(rp); if (u) window.open(u, '_blank'); }}>Receipt{all.length > 1 ? ` ${ri + 1}` : ''}</button>)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {zoom && <div className="fixed inset-0 z-[100] bg-foreground/80 flex items-center justify-center p-4" onClick={() => setZoom(null)}><img src={zoom} className="max-h-full max-w-full rounded" alt="" /><ImageIcon className="hidden" /></div>}
    </div>
  );
}
