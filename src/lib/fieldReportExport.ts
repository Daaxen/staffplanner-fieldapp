import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { workOrderBillables, type BillableLine } from '@/lib/workOrderBillables';

type Any = Record<string, any>;
export type FieldReportData = {
  orderId: string;
  orderName: string;
  orderNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  clientName?: string | null;
  reports: Any[]; time: Any[]; dev: Any[]; mil: Any[]; exp: Any[];
  names: Record<string, string>; order: Any | null; client: Any | null; photos: Record<string, string>;
};

export type ExcludeKey = 'prices' | 'comments' | 'deviations' | 'travel' | 'expenses' | 'photos';
export type ReportKind = 'client' | 'internal';
export const EXCLUDE_OPTIONS: { key: ExcludeKey; label: string }[] = [
  { key: 'prices', label: 'Priser och belopp' },
  { key: 'comments', label: 'Montörernas tidskommentarer' },
  { key: 'deviations', label: 'Avvikelser' },
  { key: 'travel', label: 'Restid och körning' },
  { key: 'expenses', label: 'Utlägg' },
  { key: 'photos', label: 'Foton' },
];
export const DEFAULT_EXCLUDES: Record<ReportKind, ExcludeKey[]> = {
  client: ['prices', 'comments', 'deviations'],
  internal: [],
};

const by = <T extends Any>(rows: T[] | null | undefined, id: string) => (rows ?? []).filter(r => r.project_id === id);

/** Loads everything saved for the given work orders in a few batched queries. */
export async function loadFieldReportData(orderIds: string[]): Promise<FieldReportData[]> {
  if (!orderIds.length) return [];
  const [r, t, dv, m, e, p] = await Promise.all([
    supabase.from('field_reports').select('*').in('project_id', orderIds),
    supabase.from('time_entries').select('project_id,installer_id,entry_date,hours,travel_hours,hourly_rate,note,description').in('project_id', orderIds).order('entry_date'),
    supabase.from('deviations').select('*').in('project_id', orderIds),
    supabase.from('mileage_entries').select('project_id,installer_id,entry_date,km,amount,note').in('project_id', orderIds),
    supabase.from('expense_entries').select('project_id,installer_id,entry_date,category,amount,note,receipt_path').in('project_id', orderIds),
    supabase.from('projects').select('id,name,project_number,start_date,end_date,client_name,hourly_rate,client_id').in('id', orderIds),
  ]);
  const clientIds = [...new Set((p.data ?? []).map(x => x.client_id).filter(Boolean))] as string[];
  const clients: Record<string, Any> = {};
  if (clientIds.length) (await supabase.from('clients').select('id,name,hourly_rate').in('id', clientIds)).data?.forEach(c => { clients[c.id] = c; });
  const ids = new Set<string>();
  [r.data, t.data, dv.data, m.data, e.data].forEach(a => (a ?? []).forEach((x: Any) => ids.add(x.installer_id)));
  const names: Record<string, string> = {};
  if (ids.size) (await supabase.from('installers').select('id,name').in('id', [...ids])).data?.forEach(i => { names[i.id] = i.name; });
  const paths = [...(r.data ?? []).flatMap((x: Any) => x.photo_paths ?? []), ...(dv.data ?? []).flatMap((x: Any) => x.photo_paths ?? [])].filter((x: unknown) => typeof x === 'string') as string[];
  const photos: Record<string, string> = {};
  if (paths.length) (await supabase.storage.from('field-photos').createSignedUrls(paths, 3600)).data?.forEach(s => { if (s.signedUrl && s.path) photos[s.path] = s.signedUrl; });
  const orders = new Map((p.data ?? []).map(o => [o.id, o]));
  return orderIds.map(id => {
    const o = orders.get(id) ?? null;
    const client = o?.client_id ? clients[o.client_id] ?? null : null;
    return {
      orderId: id, orderName: o?.name ?? 'Work order', orderNumber: o?.project_number, startDate: o?.start_date, endDate: o?.end_date,
      clientName: client?.name ?? o?.client_name ?? null,
      reports: by(r.data, id), time: by(t.data, id), dev: by(dv.data, id), mil: by(m.data, id), exp: by(e.data, id),
      names, order: o, client, photos,
    };
  });
}

const billables = (d: FieldReportData) => workOrderBillables(d.time as any, d.mil as any, d.exp as any, d.order, d.client);

/** Combined totals across orders, honouring exclusions (travel/expenses removed from the total). */
export function combinedTotals(list: FieldReportData[], exclude: ExcludeKey[] = []) {
  const x = new Set(exclude);
  const rows = list.map(d => {
    const t = billables(d).total;
    const mileage = x.has('travel') ? 0 : t.mileageAmount;
    const expenses = x.has('expenses') ? 0 : t.expenseAmount;
    return { d, t, total: Math.round((t.workAmount + mileage + expenses) * 100) / 100 };
  });
  return { rows, grand: Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100, hours: Math.round(rows.reduce((s, r) => s + r.t.workHours, 0) * 100) / 100 };
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}\- ]/gu, '').trim().replace(/\s+/g, '_') || 'workorder';
const nm = (d: FieldReportData, id: string) => d.names[id] ?? 'Unknown';
const label = (d: FieldReportData) => `${d.orderNumber ? d.orderNumber + ' – ' : ''}${d.orderName}`;

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const fileBase = (list: FieldReportData[], kind: ReportKind) =>
  list.length === 1 ? `Faltrapport_${safe(list[0].orderName)}` : `Rapport_${kind === 'client' ? 'kund' : 'intern'}_${list.length}_ordrar_${new Date().toLocaleDateString('sv-SE')}`;

export function exportFieldReportXlsx(input: FieldReportData | FieldReportData[], opts: { exclude?: ExcludeKey[]; kind?: ReportKind } = {}) {
  const list = Array.isArray(input) ? input : [input];
  const x = new Set(opts.exclude ?? []);
  const kind = opts.kind ?? 'internal';
  const wb = XLSX.utils.book_new();
  const { rows, grand, hours } = combinedTotals(list, opts.exclude);
  const summary = rows.map(({ d, t, total }) => {
    const row: Any = { Order: label(d), Kund: d.clientName ?? '', Period: `${d.startDate ?? ''} – ${d.endDate ?? ''}`, 'Arbetstid (h)': t.workHours };
    if (!x.has('prices')) row['Arbete (kr)'] = t.workAmount;
    if (!x.has('travel')) { row['Restid (h)'] = t.travelHours; row['Körning (km)'] = t.km; if (!x.has('prices')) row['Körning (kr)'] = t.mileageAmount; }
    if (!x.has('expenses') && !x.has('prices')) row['Utlägg (kr)'] = t.expenseAmount;
    if (!x.has('prices')) row['Totalt (kr)'] = total;
    return row;
  });
  const tot: Any = { Order: 'TOTALT', 'Arbetstid (h)': hours };
  if (!x.has('prices')) tot['Totalt (kr)'] = grand;
  summary.push(tot);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Sammanställning');

  // Per-installer billables for single-order exports (kept from the original export).
  if (list.length === 1) {
    const b = billables(list[0]);
    const per = (n: string, l: BillableLine): Any => {
      const r: Any = { Montör: n, 'Arbetstid (h)': l.workHours };
      if (!x.has('prices')) r['Arbete (kr)'] = l.workAmount;
      if (!x.has('travel')) { r['Restid (h)'] = l.travelHours; r['Körning (km)'] = l.km; if (!x.has('prices')) r['Körning (kr)'] = l.mileageAmount; }
      if (!x.has('expenses') && !x.has('prices')) r['Utlägg (kr)'] = l.expenseAmount;
      if (!x.has('prices')) { r['Totalt (kr)'] = l.total; r['Rader utan pris'] = l.unpricedRows; }
      return r;
    };
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...Object.entries(b.perInstaller).map(([id, l]) => per(nm(list[0], id), l)), per('TOTALT', b.total)]), 'Debiterbart');
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(list.flatMap(d => d.time.map(r => {
    const row: Any = { Order: label(d), Datum: r.entry_date, Montör: nm(d, r.installer_id), 'Arbetstid (h)': Number(r.hours) };
    if (!x.has('travel')) row['Restid (h)'] = Number(r.travel_hours ?? 0);
    if (!x.has('prices')) row.Timpris = r.hourly_rate ?? '';
    if (!x.has('comments')) row.Beskrivning = r.description || r.note || '';
    return row;
  }))), 'Tid');
  if (!x.has('travel')) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(list.flatMap(d => d.mil.map(r => ({ Order: label(d), Datum: r.entry_date, Montör: nm(d, r.installer_id), Km: Number(r.km), ...(x.has('prices') ? {} : { 'Belopp (kr)': Number(r.amount) }), Anteckning: r.note ?? '' })))), 'Körning');
  if (!x.has('expenses')) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(list.flatMap(d => d.exp.map(r => ({ Order: label(d), Datum: r.entry_date, Montör: nm(d, r.installer_id), Kategori: r.category, ...(x.has('prices') ? {} : { 'Belopp (kr)': Number(r.amount) }), Kvitto: r.receipt_path ? 'Ja' : 'Nej', Anteckning: r.note ?? '' })))), 'Utlägg');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(list.flatMap(d => d.reports.map(r => ({ Order: label(d), Montör: nm(d, r.installer_id), Inskickad: r.submitted_at ? new Date(r.submitted_at).toLocaleString('sv-SE') : 'Nej', Rapport: r.report_text ?? '' })))), 'Rapporter');
  if (!x.has('deviations')) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(list.flatMap(d => d.dev.map(r => ({ Order: label(d), Montör: nm(d, r.installer_id), Kategori: r.category, Allvar: r.severity, Status: r.status, Beskrivning: r.description })))), 'Avvikelser');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  save(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase(list, kind)}.xlsx`);
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
const HEAD: [number, number, number] = [30, 41, 59];

export async function exportFieldReportPdf(input: FieldReportData | FieldReportData[], opts: { exclude?: ExcludeKey[]; kind?: ReportKind } = {}) {
  const list = Array.isArray(input) ? input : [input];
  const x = new Set(opts.exclude ?? []);
  const kind = opts.kind ?? 'internal';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  let y = 18;
  const need = (h: number) => { if (y + h > 282) { doc.addPage(); y = 18; } };
  const text = (s: string, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    for (const line of doc.splitTextToSize(s, W - 2 * M)) { need(size * 0.45); doc.text(line, M, y); y += size * 0.45; }
  };
  const lastY = () => (doc as any).lastAutoTable.finalY as number;
  const { rows, grand, hours } = combinedTotals(list, opts.exclude);

  // Cover
  const title = list.length === 1 ? `Fältrapport – ${list[0].orderName}` : `${kind === 'client' ? 'Kundrapport' : 'Intern rapport'} – ${list.length} arbetsordrar`;
  text(title, 16, true); y += 2;
  const customers = [...new Set(list.map(d => d.clientName).filter(Boolean))];
  if (customers.length) text(`Kund: ${customers.join(', ')}`, 10);
  const starts = list.map(d => d.startDate).filter(Boolean).sort() as string[];
  const ends = list.map(d => d.endDate).filter(Boolean).sort() as string[];
  if (starts.length) text(`Period: ${starts[0]} – ${ends[ends.length - 1] ?? starts[0]}`, 10);
  text(`Antal ordrar: ${list.length} · Arbetstid: ${hours} h${x.has('prices') ? '' : ` · Totalt: ${kr(grand)}`}`, 10);
  text(`Exporterad ${new Date().toLocaleString('sv-SE')}`, 9); y += 4;

  for (const [oi, d] of list.entries()) {
    if (list.length > 1) { if (oi > 0) { doc.addPage(); y = 18; } text(label(d), 14, true); if (d.startDate) text(`${d.startDate} – ${d.endDate ?? d.startDate}`, 9); y += 2; }
    const ids = [...new Set([...d.reports.map(r => r.installer_id), ...d.time.map(t => t.installer_id)])];
    for (const id of ids) {
      const rep = d.reports.find(r => r.installer_id === id);
      need(12); text(nm(d, id), 12, true);
      text(rep?.submitted_at ? `Inskickad ${new Date(rep.submitted_at).toLocaleString('sv-SE')}` : 'Rapport ej inskickad', 9);
      y += 1;
      if (rep?.report_text) { text('Installationsrapport', 10, true); text(rep.report_text); y += 2; }
      const rowsC = x.has('comments') ? [] : d.time.filter(t => t.installer_id === id && (t.description || t.note));
      if (rowsC.length) {
        autoTable(doc, { startY: y, margin: { left: M, right: M }, head: [['Datum', 'Kommentar']], body: rowsC.map(r => [r.entry_date, r.description || r.note]), styles: { fontSize: 9 }, headStyles: { fillColor: HEAD } });
        y = lastY() + 4;
      }
      if (!x.has('photos')) for (const p of (rep?.photo_paths ?? []) as string[]) {
        const u = d.photos[p]; if (!u) continue;
        const img = await toJpeg(u); if (!img) continue;
        const w = 80, h = (img.h / img.w) * w;
        need(h + 4); doc.addImage(img.data, 'JPEG', M, y, w, h); y += h + 4;
      }
      y += 2;
    }
    if (!x.has('deviations') && d.dev.length) {
      need(12); text('Avvikelser', 12, true);
      autoTable(doc, { startY: y, margin: { left: M, right: M }, head: [['Montör', 'Kategori', 'Allvar', 'Beskrivning']], body: d.dev.map(v => [nm(d, v.installer_id), v.category, v.severity, v.description]), styles: { fontSize: 9 }, headStyles: { fillColor: [185, 28, 28] } });
      y = lastY() + 6;
    }

    // Billables per installer
    const b = billables(d);
    need(20); text(x.has('prices') ? 'Tid' : 'Debiterbart', 12, true);
    const head = ['Montör', 'Arbetstid'];
    if (!x.has('prices')) head.push('Arbete');
    if (!x.has('travel')) head.push('Restid', 'Körning');
    if (!x.has('expenses') && !x.has('prices')) head.push('Utlägg');
    if (!x.has('prices')) head.push('Totalt');
    const line = (n: string, l: BillableLine) => {
      const r = [n, `${l.workHours} h`];
      if (!x.has('prices')) r.push(kr(l.workAmount));
      if (!x.has('travel')) r.push(`${l.travelHours} h`, x.has('prices') ? `${l.km} km` : `${l.km} km / ${kr(l.mileageAmount)}`);
      if (!x.has('expenses') && !x.has('prices')) r.push(kr(l.expenseAmount));
      if (!x.has('prices')) r.push(kr(l.workAmount + (x.has('travel') ? 0 : l.mileageAmount) + (x.has('expenses') ? 0 : l.expenseAmount)));
      return r;
    };
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, head: [head],
      body: Object.entries(b.perInstaller).map(([id, l]) => line(nm(d, id), l)), foot: [line('Totalt', b.total)],
      styles: { fontSize: 9 }, headStyles: { fillColor: HEAD }, footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
    });
    y = lastY() + 4;
    if (!x.has('prices') && b.total.unpricedRows) text(`${b.total.unpricedRows} tidsrader saknar timpris och är inte prissatta.`, 9);
    if (!x.has('expenses') && d.exp.length) {
      autoTable(doc, { startY: y + 2, margin: { left: M, right: M }, head: [['Datum', 'Montör', 'Kategori', ...(x.has('prices') ? [] : ['Belopp'])]], body: d.exp.map(v => [v.entry_date, nm(d, v.installer_id), v.category, ...(x.has('prices') ? [] : [kr(Number(v.amount))])]), styles: { fontSize: 9 }, headStyles: { fillColor: HEAD } });
      y = lastY() + 4;
    }
  }

  if (list.length > 1) {
    doc.addPage(); y = 18;
    text('Sammanställning', 14, true); y += 2;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Order', 'Kund', 'Period', 'Arbetstid', ...(x.has('prices') ? [] : ['Totalt'])]],
      body: rows.map(r => [label(r.d), r.d.clientName ?? '', `${r.d.startDate ?? ''} – ${r.d.endDate ?? ''}`, `${r.t.workHours} h`, ...(x.has('prices') ? [] : [kr(r.total)])]),
      foot: [['Totalt', '', '', `${hours} h`, ...(x.has('prices') ? [] : [kr(grand)])]],
      styles: { fontSize: 9 }, headStyles: { fillColor: HEAD }, footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
    });
  }
  save(doc.output('blob'), `${fileBase(list, kind)}.pdf`);
}
