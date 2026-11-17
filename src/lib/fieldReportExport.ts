import { receiptPathsOf } from '@/lib/receipts';
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
  reports: Any[]; time: Any[]; dev: Any[]; mil: Any[]; exp: Any[]; perDiem?: Any[];
  names: Record<string, string>; order: Any | null; client: Any | null; photos: Record<string, string>;
};

export type ExcludeKey = 'prices' | 'comments' | 'deviations' | 'travel' | 'expenses' | 'perdiem' | 'photos';
export type ReportKind = 'client' | 'internal';
export const EXCLUDE_OPTIONS: { key: ExcludeKey; label: string }[] = [
  { key: 'prices', label: 'Priser och belopp' },
  { key: 'comments', label: 'Montörernas tidskommentarer' },
  { key: 'deviations', label: 'Avvikelser' },
  { key: 'travel', label: 'Restid och körning' },
  { key: 'expenses', label: 'Utlägg' },
  { key: 'perdiem', label: 'Traktamenten' },
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
  const [r, t, dv, m, e, p, pd] = await Promise.all([
    supabase.from('field_reports').select('*').in('project_id', orderIds),
    supabase.from('time_entries').select('project_id,installer_id,entry_date,hours,travel_hours,hourly_rate,note,description').in('project_id', orderIds).order('entry_date'),
    supabase.from('deviations').select('*').in('project_id', orderIds),
    supabase.from('mileage_entries').select('project_id,installer_id,entry_date,km,amount,note').in('project_id', orderIds),
    supabase.from('expense_entries').select('project_id,installer_id,entry_date,category,amount,note,receipt_path,receipt_paths').in('project_id', orderIds),
    supabase.from('projects').select('id,name,project_number,start_date,end_date,client_name,hourly_rate,client_id,location,country,status').in('id', orderIds),
    supabase.from('per_diem_entries').select('project_id,installer_id,entry_date,country,day_type,overnight,breakfast_provided,lunch_provided,dinner_provided,amount,note').in('project_id', orderIds).order('entry_date'),
  ]);
  const clientIds = [...new Set((p.data ?? []).map(x => x.client_id).filter(Boolean))] as string[];
  const clients: Record<string, Any> = {};
  if (clientIds.length) (await supabase.from('clients').select('id,name,hourly_rate').in('id', clientIds)).data?.forEach(c => { clients[c.id] = c; });
  const ids = new Set<string>();
  [r.data, t.data, dv.data, m.data, e.data, pd.data].forEach(a => (a ?? []).forEach((x: Any) => ids.add(x.installer_id)));
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
      reports: by(r.data, id), time: by(t.data, id), dev: by(dv.data, id), mil: by(m.data, id), exp: by(e.data, id), perDiem: by(pd.data, id),
      names, order: o, client, photos,
    };
  });
}

const billables = (d: FieldReportData) => workOrderBillables(d.time as any, d.mil as any, d.exp as any, d.order, d.client);
const r2 = (n: number) => Math.round(n * 100) / 100;
const perDiemSum = (d: FieldReportData) => r2((d.perDiem ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));

/** Combined totals across orders, honouring exclusions (excluded parts are removed from the total). */
export function combinedTotals(list: FieldReportData[], exclude: ExcludeKey[] = []) {
  const x = new Set(exclude);
  const rows = list.map(d => {
    const t = billables(d).total;
    const mileage = x.has('travel') ? 0 : t.mileageAmount;
    const expenses = x.has('expenses') ? 0 : t.expenseAmount;
    const perDiem = x.has('perdiem') ? 0 : perDiemSum(d);
    return { d, t, perDiem, total: r2(t.workAmount + mileage + expenses + perDiem) };
  });
  return {
    rows,
    grand: r2(rows.reduce((s, r) => s + r.total, 0)),
    hours: r2(rows.reduce((s, r) => s + r.t.workHours, 0)),
    travelHours: r2(rows.reduce((s, r) => s + r.t.travelHours, 0)),
    km: r2(rows.reduce((s, r) => s + r.t.km, 0)),
    mileage: r2(rows.reduce((s, r) => s + r.t.mileageAmount, 0)),
    expenses: r2(rows.reduce((s, r) => s + r.t.expenseAmount, 0)),
    perDiem: r2(rows.reduce((s, r) => s + r.perDiem, 0)),
  };
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}\- ]/gu, '').trim().replace(/\s+/g, '_') || 'workorder';
const nm = (d: FieldReportData, id: string) => d.names[id] ?? 'Okänd';
const label = (d: FieldReportData) => `${d.orderNumber ? d.orderNumber + ' – ' : ''}${d.orderName}`;

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const fileBase = (list: FieldReportData[], kind: ReportKind) =>
  list.length === 1 ? `Faltrapport_${safe(list[0].orderName)}` : `Rapport_${kind === 'client' ? 'kund' : 'intern'}_${list.length}_ordrar_${new Date().toLocaleDateString('sv-SE')}`;

const DAY_TYPE: Record<string, string> = { full: 'Heldag', half: 'Halvdag', none: 'Ingen dag' };
const meals = (p: Any) => [p.breakfast_provided && 'frukost', p.lunch_provided && 'lunch', p.dinner_provided && 'middag'].filter(Boolean).join(', ');
export const perDiemText = (p: Any) => `${p.country ?? ''} ${DAY_TYPE[p.day_type] ?? p.day_type ?? ''}${meals(p) ? ` (avdrag ${meals(p)})` : ''}${p.overnight === 'private' ? ' + nattraktamente' : ''}`.trim();

export type FlatRow = {
  Ordernr: string; Order: string; Kund: string; Datum: string; Montör: string; Kostnadsslag: string;
  Beskrivning: string; Antal: number; Enhet: string; 'Á-pris': number | ''; 'Belopp (kr)': number | ''; Kvitton: number | '';
};

/** One row per transaction across all orders: strict column/row model for copy-paste and pivots. */
export function flatReportRows(list: FieldReportData[], exclude: ExcludeKey[] = []): FlatRow[] {
  const x = new Set(exclude);
  const out: FlatRow[] = [];
  for (const d of list) {
    const base = { Ordernr: d.orderNumber ?? '', Order: d.orderName, Kund: d.clientName ?? '' };
    const price = (n: number | null | undefined): number | '' => (x.has('prices') || n == null ? '' : r2(Number(n)));
    for (const t of d.time) {
      const rate = t.hourly_rate ?? d.order?.hourly_rate ?? d.client?.hourly_rate ?? null;
      const desc = x.has('comments') ? '' : (t.description || t.note || '');
      if (Number(t.hours)) out.push({ ...base, Datum: t.entry_date, Montör: nm(d, t.installer_id), Kostnadsslag: 'Arbete', Beskrivning: desc, Antal: Number(t.hours), Enhet: 'h', 'Á-pris': price(rate), 'Belopp (kr)': price(rate == null ? null : Number(t.hours) * Number(rate)), Kvitton: '' });
      if (!x.has('travel') && Number(t.travel_hours)) out.push({ ...base, Datum: t.entry_date, Montör: nm(d, t.installer_id), Kostnadsslag: 'Restid', Beskrivning: '', Antal: Number(t.travel_hours), Enhet: 'h', 'Á-pris': '', 'Belopp (kr)': '', Kvitton: '' });
    }
    if (!x.has('travel')) for (const m of d.mil) out.push({ ...base, Datum: m.entry_date, Montör: nm(d, m.installer_id), Kostnadsslag: 'Körning', Beskrivning: m.note ?? '', Antal: Number(m.km), Enhet: 'km', 'Á-pris': price(Number(m.km) ? Number(m.amount) / Number(m.km) : null), 'Belopp (kr)': price(m.amount), Kvitton: '' });
    if (!x.has('expenses')) for (const e of d.exp) out.push({ ...base, Datum: e.entry_date, Montör: nm(d, e.installer_id), Kostnadsslag: 'Utlägg', Beskrivning: [e.category, e.note].filter(Boolean).join(' – '), Antal: 1, Enhet: 'st', 'Á-pris': price(e.amount), 'Belopp (kr)': price(e.amount), Kvitton: receiptPathsOf(e).length });
    if (!x.has('perdiem')) for (const p of d.perDiem ?? []) out.push({ ...base, Datum: p.entry_date, Montör: nm(d, p.installer_id), Kostnadsslag: 'Traktamente', Beskrivning: perDiemText(p), Antal: 1, Enhet: 'dag', 'Á-pris': price(p.amount), 'Belopp (kr)': price(p.amount), Kvitton: '' });
  }
  return out.sort((a, b) => a.Ordernr.localeCompare(b.Ordernr) || a.Order.localeCompare(b.Order) || a.Datum.localeCompare(b.Datum) || a.Montör.localeCompare(b.Montör));
}

export function exportFieldReportXlsx(input: FieldReportData | FieldReportData[], opts: { exclude?: ExcludeKey[]; kind?: ReportKind } = {}) {
  const list = Array.isArray(input) ? input : [input];
  const rows = flatReportRows(list, opts.exclude);
  const ws = XLSX.utils.json_to_sheet(rows, { header: ['Ordernr', 'Order', 'Kund', 'Datum', 'Montör', 'Kostnadsslag', 'Beskrivning', 'Antal', 'Enhet', 'Á-pris', 'Belopp (kr)', 'Kvitton'] });
  ws['!cols'] = [10, 28, 24, 11, 18, 13, 40, 8, 6, 10, 12, 8].map(wch => ({ wch }));
  ws['!autofilter'] = { ref: ws['!ref'] ?? 'A1:L1' };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rapportunderlag');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  save(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase(list, opts.kind ?? 'internal')}.xlsx`);
}

async function toJpeg(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = bmp.width * scale; c.height = bmp.height * scale;
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height };
  } catch { return null; }
}

// FETCH brand palette (matches the app's navy sidebar and status colours).
const NAVY: [number, number, number] = [15, 23, 42];
const INK: [number, number, number] = [30, 41, 59];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 232, 240];
const SOFT: [number, number, number] = [241, 245, 249];
const ZEBRA: [number, number, number] = [248, 250, 252];
const RED: [number, number, number] = [220, 38, 38];
const STATUS: Record<string, { label: string; c: [number, number, number] }> = {
  completed: { label: 'SLUTFÖRD', c: [22, 163, 74] }, in_progress: { label: 'PÅGÅR', c: [217, 119, 6] },
  scheduled: { label: 'PLANERAD', c: [37, 99, 235] }, on_hold: { label: 'PAUSAD', c: [234, 88, 12] },
  cancelled: { label: 'AVBRUTEN', c: [100, 116, 139] }, unassigned: { label: 'EJ TILLDELAD', c: [147, 51, 234] },
};
const kr = (n: number) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kr`;
const num = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 2 });

/** Builds the branded A4 report. Used for both download and in-app preview. */
export async function buildFieldReportPdf(input: FieldReportData | FieldReportData[], opts: { exclude?: ExcludeKey[]; kind?: ReportKind } = {}) {
  const list = Array.isArray(input) ? input : [input];
  const x = new Set(opts.exclude ?? []);
  const kind = opts.kind ?? 'internal';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, CW = W - 2 * M, TOP = 30, BOTTOM = 280;
  let y = TOP;
  const docTitle = kind === 'client' ? 'ARBETSRAPPORT' : 'INTERN RAPPORT';
  const font = (size: number, bold = false, color: [number, number, number] = INK) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); };
  const newPage = () => { doc.addPage(); y = TOP; };
  const need = (h: number) => { if (y + h > BOTTOM) newPage(); };
  const lastY = () => (doc as any).lastAutoTable.finalY as number;
  const tableBase = {
    margin: { left: M, right: M, top: TOP, bottom: 297 - BOTTOM },
    styles: { fontSize: 8.5, cellPadding: 2.2, textColor: INK, lineColor: LINE, lineWidth: 0 },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' as const },
    alternateRowStyles: { fillColor: ZEBRA },
    footStyles: { fillColor: SOFT, textColor: NAVY, fontStyle: 'bold' as const },
  };
  const section = (n: number, title: string) => {
    need(16);
    doc.setFillColor(...NAVY); doc.rect(M, y - 3.6, 1.6, 5, 'F');
    font(11.5, true, NAVY); doc.text(`${n}. ${title.toUpperCase()}`, M + 4, y); y += 4;
  };
  const kpis = (items: { k: string; v: string }[]) => {
    const gap = 2.5, w = (CW - gap * (items.length - 1)) / items.length, h = 17;
    need(h + 4);
    items.forEach((it, i) => {
      const last = i === items.length - 1, cx = M + i * (w + gap);
      doc.setFillColor(...(last ? NAVY : SOFT)); doc.roundedRect(cx, y, w, h, 1.8, 1.8, 'F');
      font(6.5, true, last ? [203, 213, 225] : MUTED); doc.text(it.k, cx + 3, y + 5.5);
      font(items.length > 5 ? 10.5 : 12, true, last ? [255, 255, 255] : NAVY); doc.text(it.v, cx + 3, y + 12.5, { maxWidth: w - 4 });
    });
    y += h + 7;
  };
  const infoBox = (bx: number, bw: number, title: string, rows: [string, string][], badge?: { label: string; c: [number, number, number] }) => {
    const h = 9 + rows.length * 5.2 + 3;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.setFillColor(255, 255, 255); doc.roundedRect(bx, y, bw, h, 1.8, 1.8, 'FD');
    doc.setFillColor(...SOFT); doc.roundedRect(bx, y, bw, 7.5, 1.8, 1.8, 'F'); doc.rect(bx, y + 4, bw, 3.5, 'F');
    font(8, true, NAVY); doc.text(title, bx + 3.5, y + 5.2);
    if (badge) {
      font(7, true, [255, 255, 255]); const tw = doc.getTextWidth(badge.label) + 6;
      doc.setFillColor(...badge.c); doc.roundedRect(bx + bw - tw - 3, y + 1.4, tw, 4.8, 2.4, 2.4, 'F');
      doc.text(badge.label, bx + bw - tw, y + 4.7);
    }
    rows.forEach(([k, v], i) => {
      const ry = y + 12.5 + i * 5.2;
      font(8, true, MUTED); doc.text(k, bx + 3.5, ry);
      font(8.5, false, INK); doc.text(doc.splitTextToSize(v || '–', bw - 32)[0], bx + 28, ry);
    });
    return h;
  };
  const paragraph = (s: string) => {
    font(9, false, INK);
    const lines = doc.splitTextToSize(s, CW - 10) as string[];
    let i = 0;
    while (i < lines.length) {
      need(12);
      const fit = Math.max(1, Math.min(lines.length - i, Math.floor((BOTTOM - y - 6) / 4.4)));
      const h = fit * 4.4 + 6;
      doc.setFillColor(...SOFT); doc.rect(M, y, CW, h, 'F'); doc.setFillColor(...NAVY); doc.rect(M, y, 1.2, h, 'F');
      font(9, false, INK); doc.text(lines.slice(i, i + fit), M + 5, y + 5.2);
      y += h + 3; i += fit;
    }
  };

  const tot = combinedTotals(list, opts.exclude);
  const kpiItems = (t: { workHours: number; travelHours: number; km: number; expenseAmount: number }, perDiem: number, total: number) => {
    const it: { k: string; v: string }[] = [{ k: 'ARBETSTID', v: `${num(t.workHours)} h` }];
    if (!x.has('travel')) it.push({ k: 'RESTID', v: `${num(t.travelHours)} h` }, { k: 'KÖRNING', v: `${num(t.km)} km` });
    if (!x.has('expenses') && !x.has('prices')) it.push({ k: 'UTLÄGG', v: kr(t.expenseAmount) });
    if (!x.has('perdiem') && !x.has('prices')) it.push({ k: 'TRAKTAMENTE', v: kr(perDiem) });
    if (!x.has('prices')) it.push({ k: 'TOTALT', v: kr(total) });
    return it;
  };

  for (const [oi, d] of list.entries()) {
    if (oi > 0) newPage();
    const row = tot.rows[oi];
    const b = billables(d);
    const o = d.order ?? {};
    const st = STATUS[o.status as string];
    const installers = [...new Set([...d.time, ...d.reports, ...d.mil, ...d.exp, ...(d.perDiem ?? [])].map(r => r.installer_id))].map(id => nm(d, id)).sort();
    const place = [o.location, o.country].filter(Boolean).join(', ');
    const gap = 4, bw = (CW - gap) / 2;
    const h1 = infoBox(M, bw, 'ORDERDETALJER', [
      ['Order', label(d)], ['Kund', d.clientName ?? ''], ['Plats', place], ['Period', `${d.startDate ?? ''} – ${d.endDate ?? d.startDate ?? ''}`], ['Montörer', installers.join(', ')],
    ]);
    const reportsIn = d.reports.filter(r => r.submitted_at).length;
    const h2 = infoBox(M + bw + gap, bw, 'STATUS', [
      ['Rapporter', `${reportsIn} av ${installers.length || d.reports.length} inskickade`],
      ['Tidsrader', String(d.time.length)],
      ['Avvikelser', String(d.dev.length)],
      ['Exporterad', new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })],
    ], st);
    y += Math.max(h1, h2) + 6;
    kpis(kpiItems(b.total, row.perDiem, row.total));

    let sec = 1;
    // 1. Time
    section(sec++, 'Arbetstid');
    const head = ['Datum', 'Montör', ...(x.has('comments') ? [] : ['Beskrivning']), 'Arbetstid', ...(x.has('prices') ? [] : ['Timpris', 'Belopp'])];
    const workRows = d.time.filter(t => Number(t.hours));
    const body = workRows.map(t => {
      const rate = t.hourly_rate ?? o.hourly_rate ?? d.client?.hourly_rate ?? null;
      return [t.entry_date, nm(d, t.installer_id), ...(x.has('comments') ? [] : [t.description || t.note || '']), `${num(Number(t.hours))} h`,
        ...(x.has('prices') ? [] : [rate == null ? '–' : kr(Number(rate)), rate == null ? '–' : kr(r2(Number(t.hours) * Number(rate)))])];
    });
    const foot = [{ content: 'Summa arbetstid', colSpan: x.has('comments') ? 2 : 3 }, `${num(b.total.workHours)} h`, ...(x.has('prices') ? [] : ['', kr(b.total.workAmount)])];
    const widths: Record<string, number> = { Datum: 21, Arbetstid: 18, Restid: 18, Timpris: 19, Belopp: 23 };
    const colStyles = (h: string[]) => Object.fromEntries(h.map((c, i) => [i, { ...(widths[c] ? { cellWidth: widths[c] } : {}), ...(['Arbetstid', 'Restid', 'Timpris', 'Belopp'].includes(c) ? { halign: 'right' as const } : {}) }]));
    autoTable(doc, { ...tableBase, startY: y, head: [head], body: body.length ? body : [[{ content: 'Ingen arbetstid registrerad', colSpan: head.length, styles: { textColor: MUTED } }]], foot: [foot], columnStyles: colStyles(head), showFoot: 'lastPage' });
    y = lastY() + 3;
    if (!x.has('prices') && b.total.unpricedRows) { font(8, false, RED); doc.text(`${b.total.unpricedRows} tidsrader saknar timpris och är inte prissatta.`, M, y + 2); y += 5; }
    y += 5;

    if (!x.has('travel')) {
      section(sec++, 'Restid');
      const th = ['Datum', 'Montör', 'Restid'];
      const tb = d.time.filter(t => Number(t.travel_hours)).map(t => [t.entry_date, nm(d, t.installer_id), `${num(Number(t.travel_hours))} h`]);
      autoTable(doc, { ...tableBase, startY: y, head: [th], body: tb.length ? tb : [[{ content: 'Ingen restid registrerad', colSpan: th.length, styles: { textColor: MUTED } }]], foot: [[{ content: 'Summa restid', colSpan: 2 }, `${num(b.total.travelHours)} h`]], columnStyles: colStyles(th), showFoot: 'lastPage' });
      y = lastY() + 8;
    }

    // 2. Mileage, expenses, per diem
    const costs: { date: string; who: string; type: string; desc: string; qty: string; unit: string; amt: number }[] = [];
    if (!x.has('travel')) d.mil.forEach(m => costs.push({ date: m.entry_date, who: nm(d, m.installer_id), type: 'Körning', desc: m.note ?? '', qty: `${num(Number(m.km))} km`, unit: Number(m.km) ? `${num(r2(Number(m.amount) / Number(m.km)))} kr/km` : '–', amt: Number(m.amount) }));
    if (!x.has('expenses')) d.exp.forEach(e => { const n = receiptPathsOf(e).length; costs.push({ date: e.entry_date, who: nm(d, e.installer_id), type: 'Utlägg', desc: [e.category, e.note].filter(Boolean).join(' – '), qty: n ? `${n} kvitto${n > 1 ? 'n' : ''}` : 'utan kvitto', unit: '', amt: Number(e.amount) }); });
    if (!x.has('perdiem')) (d.perDiem ?? []).forEach(p => costs.push({ date: p.entry_date, who: nm(d, p.installer_id), type: 'Traktamente', desc: perDiemText(p), qty: '1 dag', unit: '', amt: Number(p.amount) }));
    if (costs.length) {
      costs.sort((a, b2) => a.date.localeCompare(b2.date) || a.type.localeCompare(b2.type));
      const parts = [!x.has('travel') && 'körning', !x.has('expenses') && 'utlägg', !x.has('perdiem') && 'traktamenten'].filter(Boolean) as string[];
      section(sec++, parts.join(', ').replace(/, ([^,]*)$/, ' & $1'));
      const ch = ['Datum', 'Montör', 'Typ', 'Beskrivning', 'Antal', ...(x.has('prices') ? [] : ['Á-pris', 'Belopp'])];
      autoTable(doc, {
        ...tableBase, startY: y, head: [ch],
        body: costs.map(c => [c.date, c.who, c.type, c.desc, c.qty, ...(x.has('prices') ? [] : [c.unit, kr(c.amt)])]),
        foot: x.has('prices') ? undefined : [['Summa', '', '', '', '', '', kr(r2(costs.reduce((s, c) => s + c.amt, 0)))]],
        columnStyles: { 0: { cellWidth: 21 }, 1: { cellWidth: 28 }, 3: { cellWidth: 50 }, 6: { halign: 'right', cellWidth: 23 } }, showFoot: 'lastPage',
      });
      y = lastY() + 8;
    }

    // 3. Installation reports
    const reps = d.reports.filter(r => r.report_text || (!x.has('photos') && (r.photo_paths ?? []).length));
    if (reps.length) {
      section(sec++, 'Installationsrapport');
      for (const rep of reps) {
        need(14);
        font(9, true, NAVY); doc.text(nm(d, rep.installer_id), M, y + 1);
        font(8, false, MUTED); doc.text(rep.submitted_at ? `Inskickad ${new Date(rep.submitted_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}` : 'Ej inskickad', W - M, y + 1, { align: 'right' });
        y += 4;
        if (rep.report_text) paragraph(rep.report_text);
        if (!x.has('photos')) {
          const imgs = (await Promise.all(((rep.photo_paths ?? []) as string[]).map(p => d.photos[p] ? toJpeg(d.photos[p]) : null))).filter(Boolean) as { data: string; w: number; h: number }[];
          const cols = 3, g = 4, pw = (CW - g * (cols - 1)) / cols, ph = pw * 0.72;
          for (let i = 0; i < imgs.length; i += cols) {
            need(ph + 4);
            imgs.slice(i, i + cols).forEach((img, j) => {
              const px = M + j * (pw + g);
              doc.setFillColor(...SOFT); doc.rect(px, y, pw, ph, 'F');
              const s = Math.min(pw / img.w, ph / img.h), iw = img.w * s, ih = img.h * s;
              doc.addImage(img.data, 'JPEG', px + (pw - iw) / 2, y + (ph - ih) / 2, iw, ih);
            });
            y += ph + 4;
          }
        }
        y += 3;
      }
      y += 3;
    }
    // Comments without a report text are still useful internally.
    // 4. Deviations
    if (!x.has('deviations') && d.dev.length) {
      section(sec++, 'Avvikelser');
      autoTable(doc, { ...tableBase, startY: y, head: [['Montör', 'Kategori', 'Allvar', 'Status', 'Beskrivning']], body: d.dev.map(v => [nm(d, v.installer_id), v.category, v.severity, v.status ?? '', v.description]), headStyles: { ...tableBase.headStyles, fillColor: RED }, columnStyles: { 4: { cellWidth: 75 } } });
      y = lastY() + 8;
    }
  }

  if (list.length > 1) {
    newPage();
    section(1, 'Sammanställning');
    y += 1;
    kpis(kpiItems({ workHours: tot.hours, travelHours: tot.travelHours, km: tot.km, expenseAmount: tot.expenses }, tot.perDiem, tot.grand));
    const sh = ['Order', 'Kund', 'Period', 'Arbetstid', ...(x.has('travel') ? [] : ['Restid']), ...(x.has('prices') ? [] : ['Totalt'])];
    autoTable(doc, {
      ...tableBase, startY: y, head: [sh],
      body: tot.rows.map(r => [label(r.d), r.d.clientName ?? '', `${r.d.startDate ?? ''} – ${r.d.endDate ?? ''}`, `${num(r.t.workHours)} h`, ...(x.has('travel') ? [] : [`${num(r.t.travelHours)} h`]), ...(x.has('prices') ? [] : [kr(r.total)])]),
      foot: [['Totalt', '', '', `${num(tot.hours)} h`, ...(x.has('travel') ? [] : [`${num(tot.travelHours)} h`]), ...(x.has('prices') ? [] : [kr(tot.grand)])]],
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }, showFoot: 'lastPage',
    });
  }

  // Header + footer on every page.
  const pages = doc.getNumberOfPages();
  const ref = list.length === 1 ? (list[0].orderNumber ? `WO-${list[0].orderNumber}` : '') : `${list.length} arbetsordrar`;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 20, 'F');
    font(18, true, [255, 255, 255]); doc.text('FETCH', M, 13);
    font(10, true, [255, 255, 255]); doc.text(docTitle, W - M, 10, { align: 'right' });
    font(8.5, false, [203, 213, 225]); doc.text(ref, W - M, 15, { align: 'right' });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, 286, W - M, 286);
    font(8, true, NAVY); doc.text('FETCH', M, 291);
    font(7.5, false, MUTED);
    doc.text(kind === 'client' ? 'Arbetsrapport' : 'Internt underlag – konfidentiellt', W / 2, 291, { align: 'center' });
    doc.text(`Sida ${p} av ${pages}`, W - M, 291, { align: 'right' });
  }
  return { doc, filename: `${fileBase(list, kind)}.pdf` };
}

export async function exportFieldReportPdf(input: FieldReportData | FieldReportData[], opts: { exclude?: ExcludeKey[]; kind?: ReportKind } = {}) {
  const { doc, filename } = await buildFieldReportPdf(input, opts);
  save(doc.output('blob'), filename);
}

/** Returns an object URL for previewing the PDF in an iframe; revoke when done. */
export async function previewFieldReportPdf(input: FieldReportData | FieldReportData[], opts: { exclude?: ExcludeKey[]; kind?: ReportKind } = {}) {
  const { doc } = await buildFieldReportPdf(input, opts);
  return URL.createObjectURL(doc.output('blob'));
}
