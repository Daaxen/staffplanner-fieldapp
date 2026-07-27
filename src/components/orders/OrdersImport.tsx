import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileSpreadsheet, AlertTriangle, Check, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  installers, clientRegister, statusLabels, projectTypeLabels,
  type Project, type ProjectStatus, type ProjectType,
} from '@/data/mockData';

// Column definitions — order matters for the template
const COLUMNS = [
  'Order ID',
  'Order Name',
  'Project Number',
  'Type',            // installation | site-survey | transport
  'Client ID',       // must exist in client register
  'Client',          // display name (informational; Client ID is authoritative)
  'Location',        // area / city
  'Street',
  'Postal Code',
  'Region',
  'Status',          // open | scheduled | in-progress | completed | on-hold | cancelled
  'Start Date',      // YYYY-MM-DD
  'End Date',        // YYYY-MM-DD
  'Start Time',      // HH:MM
  'End Time',        // HH:MM
  'Estimated Hours',
  'Flex Order',      // yes/no
  'Description',
  'Contact Name',
  'Contact Phone',
  'Contact Email',
  'Assignees',       // semicolon-separated installer names or IDs, e.g. "Erik Lindberg; inst-3"
  'Vehicle Type',
] as const;

const STATUS_VALUES: ProjectStatus[] = ['open', 'scheduled', 'in-progress', 'completed', 'on-hold', 'cancelled'];
const TYPE_VALUES: ProjectType[] = ['installation', 'site-survey', 'transport'];

type RowAction = 'create' | 'update' | 'skip';
interface ParsedRow {
  rowNumber: number;
  action: RowAction;
  errors: string[];
  warnings: string[];
  matchedId?: string;
  patch: Partial<Project>;
  raw: Record<string, unknown>;
}

const norm = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const emptyToUndef = (v: string) => (v === '' ? undefined : v);
const toDateStr = (v: unknown): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return undefined;
  // Excel serial number
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const d = XLSX.SSF.parse_date_code(n);
    if (d) return `${d.y.toString().padStart(4, '0')}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  // ISO or parseable
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s; // return raw, let validation catch it
};
const toBool = (v: unknown): boolean | undefined => {
  const s = norm(v).toLowerCase();
  if (!s) return undefined;
  return ['yes', 'y', 'true', '1', 'x'].includes(s);
};
const parseAssignees = (v: unknown): { ids: string[]; unknown: string[] } => {
  const s = norm(v);
  if (!s) return { ids: [], unknown: [] };
  const parts = s.split(/[;,\n]/).map(p => p.trim()).filter(Boolean);
  const ids: string[] = [];
  const missing: string[] = [];
  for (const p of parts) {
    const byId = installers.find(i => i.id.toLowerCase() === p.toLowerCase());
    const byName = installers.find(i => i.name.toLowerCase() === p.toLowerCase());
    const hit = byId ?? byName;
    if (hit) ids.push(hit.id);
    else missing.push(p);
  }
  return { ids: Array.from(new Set(ids)), unknown: missing };
};

interface OrdersImportProps {
  orders: Project[];
  onApply: (next: Project[]) => void;
}

const OrdersImport = ({ orders, onApply }: OrdersImportProps) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => ({
    total: rows.length,
    create: rows.filter(r => r.action === 'create').length,
    update: rows.filter(r => r.action === 'update').length,
    skip: rows.filter(r => r.action === 'skip').length,
    errors: rows.filter(r => r.errors.length > 0).length,
    warnings: rows.filter(r => r.warnings.length > 0).length,
  }), [rows]);

  const templateUrl = '/templates/orders-import-template.xlsx';

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames.includes('Orders') ? 'Orders' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) { toast.error('No sheet found in file'); return; }
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });

    const byId = new Map(orders.map(o => [o.id, o]));
    const parsed: ParsedRow[] = json.map((raw, idx) => {
      const rowNumber = idx + 2; // header on row 1
      const errors: string[] = [];
      const warnings: string[] = [];

      const id = norm(raw['Order ID']);
      const name = norm(raw['Order Name']);
      const type = norm(raw['Type']).toLowerCase();
      const client = norm(raw['Client']);
      const location = norm(raw['Location']);
      const status = norm(raw['Status']).toLowerCase();
      const startDate = toDateStr(raw['Start Date']);
      const endDate = toDateStr(raw['End Date']);
      const estRaw = norm(raw['Estimated Hours']);
      const estHours = estRaw === '' ? undefined : Number(estRaw);
      const flex = toBool(raw['Flex Order']);
      const { ids: assigneeIds, unknown: unknownAssignees } = parseAssignees(raw['Assignees']);

      // Row totally empty → skip silently
      const anyValue = Object.values(raw).some(v => norm(v) !== '');
      if (!anyValue) {
        return { rowNumber, action: 'skip', errors: [], warnings: [], patch: {}, raw };
      }

      // Validation — only on cells the user filled in
      if (type && !TYPE_VALUES.includes(type as ProjectType)) errors.push(`Type "${type}" not one of ${TYPE_VALUES.join(', ')}`);
      if (status && !STATUS_VALUES.includes(status as ProjectStatus)) errors.push(`Status "${status}" not one of ${STATUS_VALUES.join(', ')}`);
      if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errors.push(`Start Date "${startDate}" is not YYYY-MM-DD`);
      if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) errors.push(`End Date "${endDate}" is not YYYY-MM-DD`);
      if (startDate && endDate && startDate > endDate) errors.push('End Date is before Start Date');
      if (estRaw !== '' && (Number.isNaN(estHours) || (estHours as number) < 0)) errors.push(`Estimated Hours "${estRaw}" is not a positive number`);
      if (unknownAssignees.length) warnings.push(`Unknown assignee(s): ${unknownAssignees.join(', ')} — ignored`);

      const matched = id ? byId.get(id) : undefined;
      let action: RowAction;
      if (id && !matched) {
        errors.push(`Order ID "${id}" not found — cannot update`);
        action = 'skip';
      } else if (matched) {
        action = 'update';
      } else {
        // Create requires at least a name
        if (!name) errors.push('Order Name is required to create a new order');
        action = 'create';
      }

      const patch: Partial<Project> = {};
      // Only include fields the user actually filled in (empty = don't touch)
      if (name) patch.name = name;
      if (norm(raw['Project Number'])) patch.projectNumber = norm(raw['Project Number']);
      if (type) patch.projectType = type as ProjectType;
      if (client) patch.client = client;
      if (location) patch.location = location;
      if (status) patch.status = status as ProjectStatus;
      if (startDate) patch.startDate = startDate;
      if (endDate) patch.endDate = endDate;
      if (norm(raw['Start Time'])) patch.startTime = norm(raw['Start Time']);
      if (norm(raw['End Time'])) patch.endTime = norm(raw['End Time']);
      if (estRaw !== '' && !Number.isNaN(estHours)) patch.estimatedHours = estHours;
      if (flex !== undefined) patch.isFlexOrder = flex;
      if (norm(raw['Description'])) patch.description = norm(raw['Description']);
      if (norm(raw['Contact Name'])) patch.contactName = norm(raw['Contact Name']);
      if (norm(raw['Contact Phone'])) patch.contactPhone = norm(raw['Contact Phone']);
      if (emptyToUndef(norm(raw['Contact Email']))) patch.contactEmail = norm(raw['Contact Email']);
      if (assigneeIds.length) patch.assigneeIds = assigneeIds;
      if (norm(raw['Vehicle Type'])) patch.vehicleType = norm(raw['Vehicle Type']);

      if (errors.length) action = 'skip';

      return { rowNumber, action, errors, warnings, matchedId: matched?.id, patch, raw };
    });

    setRows(parsed);
    setOpen(true);
  };

  const onPick = () => inputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await handleFile(f);
    e.target.value = '';
  };

  const apply = () => {
    const applicable = rows.filter(r => r.action !== 'skip');
    if (!applicable.length) { toast.error('Nothing to import'); return; }

    let next = [...orders];
    let created = 0, updated = 0;
    let seq = Date.now();
    for (const row of applicable) {
      if (row.action === 'update' && row.matchedId) {
        next = next.map(o => o.id === row.matchedId ? { ...o, ...row.patch } : o);
        updated++;
      } else if (row.action === 'create') {
        const newOrder: Project = {
          id: `imp-${seq++}`,
          name: row.patch.name ?? 'Untitled order',
          projectType: (row.patch.projectType ?? 'installation'),
          client: row.patch.client ?? '',
          location: row.patch.location ?? '',
          status: row.patch.status ?? 'open',
          assigneeIds: row.patch.assigneeIds ?? [],
          startDate: row.patch.startDate ?? new Date().toISOString().slice(0, 10),
          endDate: row.patch.endDate ?? row.patch.startDate ?? new Date().toISOString().slice(0, 10),
          ...row.patch,
        };
        next.push(newOrder);
        created++;
      }
    }
    onApply(next);
    toast.success(`Imported: ${created} created · ${updated} updated`);
    setOpen(false);
    setRows([]);
    setFileName('');
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
      <Button size="sm" variant="outline" asChild>
        <a href={templateUrl} download="orders-import-template.xlsx" target="_blank" rel="noreferrer">
          <Download className="w-3.5 h-3.5 mr-1" /> Template
        </a>
      </Button>
      <Button size="sm" variant="outline" onClick={onPick}>
        <Upload className="w-3.5 h-3.5 mr-1" /> Import
      </Button>

      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setRows([]); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" /> Import preview
            </DialogTitle>
            <DialogDescription>
              {fileName && <span className="font-mono">{fileName}</span>} — rows with an Order ID that matches an existing order will <b>update</b>, all others will <b>create</b> new orders. Empty cells stay empty.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-muted">Total: <b>{summary.total}</b></span>
            <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Create: <b>{summary.create}</b></span>
            <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-700 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Update: <b>{summary.update}</b></span>
            {summary.skip > 0 && <span className="px-2 py-1 rounded bg-muted text-muted-foreground">Skipped: <b>{summary.skip}</b></span>}
            {summary.errors > 0 && <span className="px-2 py-1 rounded bg-destructive/10 text-destructive inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Errors: <b>{summary.errors}</b></span>}
            {summary.warnings > 0 && <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-700 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Warnings: <b>{summary.warnings}</b></span>}
          </div>

          <div className="max-h-[420px] overflow-y-auto border border-border rounded-md divide-y divide-border">
            {rows.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No rows found in the file.</div>
            )}
            {rows.map(r => (
              <div key={r.rowNumber} className={cn(
                "px-3 py-2 text-sm flex items-start gap-3",
                r.errors.length && "bg-destructive/5",
                r.action === 'skip' && !r.errors.length && "opacity-60",
              )}>
                <div className="w-10 text-xs text-muted-foreground pt-0.5">#{r.rowNumber}</div>
                <div className="w-20 pt-0.5">
                  {r.action === 'create' && <span className="text-xs inline-flex items-center gap-1 text-emerald-700"><Plus className="w-3 h-3" />Create</span>}
                  {r.action === 'update' && <span className="text-xs inline-flex items-center gap-1 text-blue-700"><RefreshCw className="w-3 h-3" />Update</span>}
                  {r.action === 'skip' && <span className="text-xs text-muted-foreground">Skip</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {r.patch.name ?? (r.matchedId ? orders.find(o => o.id === r.matchedId)?.name : '(no name)')}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[r.matchedId && `ID ${r.matchedId}`, r.patch.client, r.patch.location, r.patch.status && statusLabels[r.patch.status], r.patch.projectType && projectTypeLabels[r.patch.projectType]].filter(Boolean).join(' · ') || '—'}
                  </div>
                  {r.errors.map((e, i) => (
                    <div key={`e${i}`} className="text-xs text-destructive inline-flex items-center gap-1 mr-3"><AlertTriangle className="w-3 h-3" />{e}</div>
                  ))}
                  {r.warnings.map((w, i) => (
                    <div key={`w${i}`} className="text-xs text-amber-700 inline-flex items-center gap-1 mr-3"><AlertTriangle className="w-3 h-3" />{w}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setRows([]); }}>Cancel</Button>
            <Button onClick={apply} disabled={summary.create + summary.update === 0}>
              <Check className="w-3.5 h-3.5 mr-1" />
              Confirm & import ({summary.create + summary.update})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OrdersImport;
