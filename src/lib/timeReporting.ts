import { z } from 'zod';
import * as XLSX from 'xlsx';

export const INTERNAL_CUSTOMER_NUMBER = '9999';
export const INTERNAL_LABEL = '9999 – Dynamic Places Intern';
export const NORMAL_DAY_HOURS = 8;
export const MAX_ROW_HOURS = 24;
export const MAX_DAY_HOURS = 24;
export const INTERNAL_HELP =
  'Beskriv tydligt vad tiden avser, exempelvis lagerunderhåll, materialinventering, verktygsservice, utbildning eller intern planering.';

const GENERIC = new Set(['internt', 'intern', 'övrigt', 'ovrigt', 'diverse', 'div', 'intern tid']);

export type TRClient = { id: string; name: string; customer_number: string | null };
export type TRGroup = { id: string; name: string; project_number: string | null; client_id: string | null };
export type TROrder = { id: string; name: string; project_number: string | null; client_id: string | null; project_group_id: string | null };

export type TimeRow = {
  id: string;
  installer_id: string;
  entry_date: string;
  client_id: string | null;
  project_group_id: string | null;
  project_id: string | null;
  activity_type_id: string | null;
  hours: number;
  travel_hours: number;
  description: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export const clientLabel = (c?: TRClient | null) =>
  !c ? '' : c.customer_number === INTERNAL_CUSTOMER_NUMBER ? INTERNAL_LABEL : `${c.customer_number ? c.customer_number + ' – ' : ''}${c.name}`;

export const rowHours = (r: Pick<TimeRow, 'hours' | 'travel_hours'>) => Number(r.hours) + Number(r.travel_hours ?? 0);

export type RowInput = {
  date: string;
  clientId: string;
  projectGroupId?: string | null;
  orderId?: string | null;
  activityTypeId: string;
  hours: number;
  description?: string;
};

export function validateRow(
  v: RowInput,
  ctx: { clients: TRClient[]; groups: TRGroup[]; orders: TROrder[]; otherHoursThatDay: number },
): string | null {
  const schema = z.object({
    date: z.string().min(1, 'Välj datum'),
    clientId: z.string().min(1, 'Välj kund'),
    activityTypeId: z.string().min(1, 'Välj aktivitetstyp'),
    hours: z
      .number({ invalid_type_error: 'Ange antal timmar' })
      .gt(0, 'Antal timmar måste vara större än 0')
      .max(MAX_ROW_HOURS, `En tidsrad får inte överstiga ${MAX_ROW_HOURS} timmar`),
  });
  const r = schema.safeParse(v);
  if (!r.success) return r.error.issues[0].message;
  const client = ctx.clients.find(c => c.id === v.clientId);
  if (!client) return 'Välj kund';
  const internal = client.customer_number === INTERNAL_CUSTOMER_NUMBER;
  if (v.projectGroupId) {
    const g = ctx.groups.find(x => x.id === v.projectGroupId);
    if (!g || g.client_id !== v.clientId)
      return internal ? 'Endast interna projekt kan väljas för kund 9999' : 'Projektet tillhör inte vald kund';
  }
  if (v.orderId) {
    const o = ctx.orders.find(x => x.id === v.orderId);
    if (!o || (o.client_id && o.client_id !== v.clientId)) return 'Ordern tillhör inte vald kund';
    if (v.projectGroupId && o.project_group_id && o.project_group_id !== v.projectGroupId)
      return 'Ordern tillhör inte valt projekt';
  }
  if (internal) {
    const d = (v.description ?? '').trim().toLowerCase();
    if (!d) return 'Beskrivning krävs för kund 9999';
    if (d.length < 15 || GENERIC.has(d)) return 'Beskriv tydligt vilken aktivitet som utförts (inte bara "internt" eller "övrigt")';
  }
  if (ctx.otherHoursThatDay + v.hours > MAX_DAY_HOURS)
    return `Total tid för dagen får inte överstiga ${MAX_DAY_HOURS} timmar`;
  return null;
}

export function sumBy<T>(rows: T[], key: (r: T) => string, hours: (r: T) => number) {
  const m = new Map<string, number>();
  rows.forEach(r => m.set(key(r), (m.get(key(r)) ?? 0) + hours(r)));
  return [...m.entries()].map(([k, h]) => ({ key: k, hours: Math.round(h * 100) / 100 })).sort((a, b) => b.hours - a.hours);
}

export const EXPORT_COLUMNS = [
  'Datum', 'Medarbetare', 'Kundnummer', 'Kundnamn', 'Projektnummer', 'Projektnamn',
  'Ordernummer', 'Aktivitetstyp', 'Antal timmar', 'Beskrivning', 'Skapad', 'Senast ändrad',
] as const;

export type ExportLine = Record<(typeof EXPORT_COLUMNS)[number], string | number>;

export const exportFileName = (from: string, to: string) => `tidsrapport_${from}_${to}.xlsx`;

export function buildWorkbook(lines: ExportLine[]) {
  const ws = XLSX.utils.json_to_sheet(lines, { header: [...EXPORT_COLUMNS] });
  const total = lines.reduce((s, l) => s + Number(l['Antal timmar'] || 0), 0);
  XLSX.utils.sheet_add_aoa(ws, [[], ['Totalt', '', '', '', '', '', '', '', Math.round(total * 100) / 100]], { origin: -1 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tidsrapport');
  return wb;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function weekDays(date: string) {
  const d = new Date(date + 'T12:00:00');
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return isoDate(x); });
}
