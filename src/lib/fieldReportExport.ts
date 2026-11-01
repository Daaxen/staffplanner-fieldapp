import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { workOrderBillables } from '@/lib/workOrderBillables';

type Any = Record<string, any>;
export type FieldReportData = {
  orderName: string;
  reports: Any[]; time: Any[]; dev: Any[]; mil: Any[]; exp: Any[];
  names: Record<string, string>; order: Any | null; client: Any | null; photos: Record<string, string>;
};

const safe = (s: string) => s.replace(/[^\p{L}\p{N}\- ]/gu, '').trim().replace(/\s+/g, '_') || 'workorder';
const nm = (d: FieldReportData, id: string) => d.names[id] ?? 'Unknown';

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function exportFieldReportXlsx(d: FieldReportData) {
  const b = workOrderBillables(d.time as any, d.mil as any, d.exp as any, d.order, d.client);
  const wb = XLSX.utils.book_new();
  const sum = Object.entries(b.perInstaller).map(([id, l]) => ({
    Montör: nm(d, id), 'Arbetstid (h)': l.workHours, 'Arbete (kr)': l.workAmount, 'Restid (h)': l.travelHours,
    'Körning (km)': l.km, 'Körning (kr)': l.mileageAmount, 'Utlägg (kr)': l.expenseAmount, 'Totalt (kr)': l.total, 'Rader utan pris': l.unpricedRows,
  }));
  const t = b.total;
  sum.push({ Montör: 'TOTALT', 'Arbetstid (h)': t.workHours, 'Arbete (kr)': t.workAmount, 'Restid (h)': t.travelHours, 'Körning (km)': t.km, 'Körning (kr)': t.mileageAmount, 'Utlägg (kr)': t.expenseAmount, 'Totalt (kr)': t.total, 'Rader utan pris': t.unpricedRows });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sum), 'Debiterbart');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.time.map(r => ({ Datum: r.entry_date, Montör: nm(d, r.installer_id), 'Arbetstid (h)': Number(r.hours), 'Restid (h)': Number(r.travel_hours ?? 0), Timpris: r.hourly_rate ?? '', Beskrivning: r.description || r.note || '' }))), 'Tid');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.mil.map(r => ({ Datum: r.entry_date, Montör: nm(d, r.installer_id), Km: Number(r.km), 'Belopp (kr)': Number(r.amount), Anteckning: r.note ?? '' }))), 'Körning');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.exp.map(r => ({ Datum: r.entry_date, Montör: nm(d, r.installer_id), Kategori: r.category, 'Belopp (kr)': Number(r.amount), Kvitto: r.receipt_path ? 'Ja' : 'Nej', Anteckning: r.note ?? '' }))), 'Utlägg');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.reports.map(r => ({ Montör: nm(d, r.installer_id), Inskickad: r.submitted_at ? new Date(r.submitted_at).toLocaleString('sv-SE') : 'Nej', Rapport: r.report_text ?? '' }))), 'Rapporter');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.dev.map(r => ({ Montör: nm(d, r.installer_id), Kategori: r.category, Allvar: r.severity, Status: r.status, Beskrivning: r.description }))), 'Avvikelser');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  save(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Faltrapport_${safe(d.orderName)}.xlsx`);
}

async function toJpeg(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = bmp.width * scale; c.height = bmp.height * scale;
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height };
  } catch { return null; }
}

const kr = (n: number) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr`;

export async function exportFieldReportPdf(d: FieldReportData) {
  const b = workOrderBillables(d.time as any, d.mil as any, d.exp as any, d.order, d.client);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  let y = 18;
  const need = (h: number) => { if (y + h > 282) { doc.addPage(); y = 18; } };
  const text = (s: string, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    for (const line of doc.splitTextToSize(s, W - 2 * M)) { need(size * 0.45); doc.text(line, M, y); y += size * 0.45; }
  };
  const lastY = () => (doc as any).lastAutoTable.finalY as number;

  text(`Fältrapport – ${d.orderName}`, 16, true); y += 2;
  text(`Exporterad ${new Date().toLocaleString('sv-SE')}`, 9); y += 4;

  const ids = [...new Set([...d.reports.map(r => r.installer_id), ...d.time.map(t => t.installer_id)])];
  for (const id of ids) {
    const rep = d.reports.find(r => r.installer_id === id);
    need(12); text(nm(d, id), 12, true);
    text(rep?.submitted_at ? `Inskickad ${new Date(rep.submitted_at).toLocaleString('sv-SE')}` : 'Rapport ej inskickad', 9);
    y += 1;
    if (rep?.report_text) { text('Installationsrapport', 10, true); text(rep.report_text); y += 2; }
    const rows = d.time.filter(t => t.installer_id === id && (t.description || t.note));
    if (rows.length) {
      autoTable(doc, { startY: y, margin: { left: M, right: M }, head: [['Datum', 'Kommentar']], body: rows.map(r => [r.entry_date, r.description || r.note]), styles: { fontSize: 9 }, headStyles: { fillColor: [30, 41, 59] } });
      y = lastY() + 4;
    }
    for (const p of (rep?.photo_paths ?? []) as string[]) {
      const u = d.photos[p]; if (!u) continue;
      const img = await toJpeg(u); if (!img) continue;
      const w = 80, h = (img.h / img.w) * w;
      need(h + 4); doc.addImage(img.data, 'JPEG', M, y, w, h); y += h + 4;
    }
    y += 2;
  }

  if (d.dev.length) {
    need(12); text('Avvikelser', 12, true);
    autoTable(doc, { startY: y, margin: { left: M, right: M }, head: [['Montör', 'Kategori', 'Allvar', 'Beskrivning']], body: d.dev.map(x => [nm(d, x.installer_id), x.category, x.severity, x.description]), styles: { fontSize: 9 }, headStyles: { fillColor: [185, 28, 28] } });
    y = lastY() + 6;
  }

  need(20); text('Debiterbart', 12, true);
  const line = (n: string, l: typeof b.total) => [n, `${l.workHours} h`, kr(l.workAmount), `${l.travelHours} h`, `${l.km} km / ${kr(l.mileageAmount)}`, kr(l.expenseAmount), kr(l.total)];
  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Montör', 'Arbetstid', 'Arbete', 'Restid', 'Körning', 'Utlägg', 'Totalt']],
    body: Object.entries(b.perInstaller).map(([id, l]) => line(nm(d, id), l)),
    foot: [line('Totalt', b.total)],
    styles: { fontSize: 9 }, headStyles: { fillColor: [30, 41, 59] }, footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
  });
  y = lastY() + 4;
  if (b.total.unpricedRows) text(`${b.total.unpricedRows} tidsrader saknar timpris och är inte prissatta.`, 9);
  if (d.exp.length) {
    autoTable(doc, { startY: y + 2, margin: { left: M, right: M }, head: [['Datum', 'Montör', 'Kategori', 'Belopp']], body: d.exp.map(x => [x.entry_date, nm(d, x.installer_id), x.category, kr(Number(x.amount))]), styles: { fontSize: 9 }, headStyles: { fillColor: [30, 41, 59] } });
  }
  save(doc.output('blob'), `Faltrapport_${safe(d.orderName)}.pdf`);
}
