import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ScrollText, RefreshCw } from 'lucide-react';

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_type: 'user' | 'admin' | 'service' | 'system' | 'cron' | 'migration';
  actor_name: string | null;
  source: string | null;
  correlation_id: string | null;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  action: 'create' | 'update' | 'delete';
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

const ACTOR_TYPE_LABELS: Record<string, string> = {
  user: 'Användare',
  admin: 'Administratör',
  service: 'Tjänst',
  system: 'System',
  cron: 'Schemalagt jobb',
  migration: 'Migrering',
};

/** Svenska etiketter för typ av post. */
const ENTITY_LABELS: Record<string, string> = {
  project: 'Order',
  client: 'Kund',
  assignment: 'Tilldelning',
  booking: 'Bokning',
  time_entry: 'Tidrapport',
  mileage_entry: 'Milersättning',
  expense_entry: 'Utlägg',
  project_economy: 'Orderekonomi',
  installer: 'Personal',
  user_role: 'Behörighet',
  deviation: 'Avvikelse',
  field_report: 'Fältrapport',
  document: 'Dokument',
  absence: 'Frånvaro',
  expense_rule: 'Utläggsregel',
  status_transition: 'Statussteg',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Skapad',
  update: 'Ändrad',
  delete: 'Borttagen',
};

/** Svenska etiketter för fältnamn. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Namn',
  status: 'Status',
  start_date: 'Startdatum',
  end_date: 'Slutdatum',
  client_id: 'Kund',
  client_ref: 'Kundnummer',
  client_name: 'Kundnamn',
  hourly_rate: 'Timpris',
  overtime_rate: 'Övertidspris',
  mileage_rate: 'Kilometerersättning',
  vat_percent: 'Moms (%)',
  location: 'Plats',
  project_type: 'Ordertyp',
  invoice_email: 'Fakturamejl',
  payment_terms_days: 'Betalningsvillkor (dagar)',
  org_number: 'Organisationsnummer',
  vat_number: 'Momsregistreringsnummer',
  installer_id: 'Personal',
  project_id: 'Order',
  planned_start_at: 'Planerad start',
  planned_end_at: 'Planerat slut',
  assignment_status: 'Bokningsstatus',
  override_reason: 'Skäl till överstyrning',
  entry_date: 'Datum',
  hours: 'Timmar',
  start_time: 'Starttid',
  end_time: 'Sluttid',
  km: 'Kilometer',
  rate: 'Ersättning',
  amount: 'Belopp',
  category: 'Kategori',
  entry_kind: 'Typ av post',
  receipt_path: 'Kvitto',
  note: 'Notering',
  type: 'Typ',
  profile_id: 'Kopplat konto',
  base_location: 'Utgångsort',
  color: 'Färg',
  role: 'Roll',
  user_id: 'Användare',
  fixed_price: 'Fast pris',
  additional_revenue: 'Övrig intäkt',
  budget_hours: 'Budgeterade timmar',
  internal_hourly_cost: 'Intern timkostnad',
  external_hourly_cost: 'Extern timkostnad',
  external_cost_extra: 'Extra extern kostnad',
  material_cost_extra: 'Extra materialkostnad',
  travel_cost_extra: 'Extra resekostnad',
  external_budget: 'Budget underleverantör',
  target_margin_pct: 'Målmarginal (%)',
  submitted_at: 'Inskickad',
  report_text: 'Rapporttext',
  checked_items: 'Checklista',
  sign_offs: 'Signeringar',
  photo_meta: 'Bildinformation',
  photo_paths: 'Bilder',
  severity: 'Allvarlighet',
  resolved_at: 'Löst',
  resolution_note: 'Lösningsanteckning',
  description: 'Beskrivning',
  scope: 'Dokumenttyp',
  visible_to_installers: 'Publicerad till montörer',
  is_sensitive: 'Känsligt dokument',
  title: 'Titel',
  label: 'Beteckning',
  requires_receipt: 'Kvitto krävs',
  receipt_threshold: 'Kvittogräns',
  max_amount: 'Maxbelopp',
  from_status: 'Från status',
  to_status: 'Till status',
};

const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

const shownValue = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nej';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const actionVariant = (a: string) =>
  a === 'create' ? 'default' : a === 'delete' ? 'destructive' : 'secondary';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

export function AuditTimeline() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('all');
  const [action, setAction] = useState('all');
  const [actorType, setActorType] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    setRows((data ?? []) as unknown as AuditRow[]);

    const { data: profiles } = await supabase.from('profiles').select('id,full_name,email');
    const map: Record<string, string> = {};
    (profiles ?? []).forEach((p: { id: string; full_name: string | null; email: string | null }) => {
      map[p.id] = p.full_name || p.email || p.id;
    });
    setActors(map);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (entity !== 'all' && r.entity_type !== entity) return false;
      if (action !== 'all' && r.action !== action) return false;
      if (actorType !== 'all' && r.actor_type !== actorType) return false;
      if (!q) return true;
      const hay = [
        r.entity_label ?? '',
        r.entity_id,
        actors[r.actor_id ?? ''] ?? '',
        r.actor_name ?? '',
        r.source ?? '',
        r.correlation_id ?? '',
        r.reason ?? '',
        JSON.stringify(r.new_values ?? {}),
        JSON.stringify(r.old_values ?? {}),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, entity, action, actorType, search, actors]);

  const changes = (r: AuditRow) => {
    const keys = new Set([
      ...Object.keys(r.new_values ?? {}),
      ...Object.keys(r.old_values ?? {}),
    ]);
    const skip = new Set(['id', 'created_at', 'updated_at', 'data']);
    return [...keys].filter((k) => !skip.has(k)).slice(0, 12);
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ScrollText className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold">Ändringslogg</h1>
          <p className="text-sm text-muted-foreground">
            Alla kritiska ändringar sparas permanent och kan varken ändras eller tas bort.
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Uppdatera
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Sök på namn, person eller värde…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla typer</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Händelse" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla händelser</SelectItem>
            <SelectItem value="create">Skapad</SelectItem>
            <SelectItem value="update">Ändrad</SelectItem>
            <SelectItem value="delete">Borttagen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actorType} onValueChange={setActorType}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Aktör" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla aktörer</SelectItem>
            {Object.entries(ACTOR_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Hämtar ändringar…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Inga ändringar att visa.</Card>
      ) : (
        <div className="relative space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
          {filtered.map((r) => (
            <div key={r.id} className="relative pl-6">
              <span className="absolute left-0 top-4 h-[15px] w-[15px] rounded-full border-2 border-background bg-primary" />
              <Card className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actionVariant(r.action)}>{ACTION_LABELS[r.action]}</Badge>
                  <span className="font-medium">
                    {ENTITY_LABELS[r.entity_type] ?? r.entity_type}
                    {r.entity_label ? ` – ${r.entity_label}` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(r.created_at)}</span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Av:{' '}
                  {r.actor_id
                    ? (actors[r.actor_id] ?? r.actor_name ?? r.actor_id)
                    : (r.actor_name ?? ACTOR_TYPE_LABELS[r.actor_type] ?? 'Systemet')}
                  {' · '}
                  {ACTOR_TYPE_LABELS[r.actor_type] ?? r.actor_type}
                  {r.source ? ` · ${r.source}` : ''}
                </p>

                {r.correlation_id && (
                  <p className="text-xs text-muted-foreground">
                    <span>Kopplings-ID: </span>
                    <span className="font-mono">{r.correlation_id}</span>
                  </p>
                )}

                {r.reason && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Skäl: </span>{r.reason}
                  </p>
                )}

                {r.action === 'update' && (
                  <ul className="text-sm space-y-1">
                    {changes(r).map((k) => (
                      <li key={k} className="flex flex-wrap gap-2">
                        <span className="text-muted-foreground">{fieldLabel(k)}:</span>
                        <span className="line-through text-muted-foreground">
                          {shownValue(r.old_values?.[k])}
                        </span>
                        <span>→</span>
                        <span className="font-medium">{shownValue(r.new_values?.[k])}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {r.action !== 'update' && (
                  <ul className="text-sm grid gap-1 sm:grid-cols-2">
                    {changes(r).map((k) => (
                      <li key={k} className="flex gap-2">
                        <span className="text-muted-foreground">{fieldLabel(k)}:</span>
                        <span className="font-medium">
                          {shownValue((r.new_values ?? r.old_values)?.[k])}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AuditTimeline;
