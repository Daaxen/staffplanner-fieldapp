import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ClipboardList,
  FileSignature,
  FileText,
  History,
  Mail,
  Phone,
  Receipt,
  TrendingUp,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useClients, useProjects } from '@/lib/appData';
import { useProfitabilityData } from '@/hooks/useProfitabilityData';
import { useFieldReportStates } from '@/hooks/useFieldReportStates';
import {
  computeProfitability,
  emptyInput,
  marginColor,
  marginLevel,
  pctLabel,
  sek,
  type Profitability,
} from '@/lib/profitability';
import { statusLabels, type Client, type Project } from '@/data/mockData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type DeviationRow = {
  id: string;
  project_ref: string;
  project_name: string | null;
  category: string;
  severity: string;
  description: string;
  occurred_at: string;
  status: string;
};

const QUOTE_STATUSES = ['open', 'scheduled'];

const belongsToClient = (p: Project, c: Client) =>
  (c.id && p.clientId === c.id) || (!!c.name && p.client === c.name);

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className={cn('mt-1.5 text-2xl font-bold', tone ?? 'text-foreground')}>{value}</p>
  </div>
);

const Row = ({
  title,
  subtitle,
  right,
  rightSub,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: string;
}) => (
  <div className="px-4 py-3 flex items-center justify-between gap-3">
    <div className="min-w-0">
      <p className="font-medium text-foreground truncate">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
    </div>
    <div className="shrink-0 text-right">
      {right && <p className="text-sm font-medium text-foreground">{right}</p>}
      {rightSub && <p className="text-xs text-muted-foreground">{rightSub}</p>}
    </div>
  </div>
);

const Panel = ({
  title,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  icon: typeof FileText;
  empty?: string;
  children?: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border bg-card">
    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    {children ?? <p className="p-6 text-sm text-muted-foreground">{empty}</p>}
  </div>
);

const Customer360 = () => {
  const [clients] = useClients();
  const [projects] = useProjects();
  const { inputs } = useProfitabilityData();
  const { reports } = useFieldReportStates();
  const [selectedId, setSelectedId] = useState<string>('');
  const [deviations, setDeviations] = useState<DeviationRow[]>([]);

  useEffect(() => {
    if (!selectedId && clients.length > 0) setSelectedId(clients[0].id);
  }, [clients, selectedId]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from('deviations')
        .select('id,project_ref,project_name,category,severity,description,occurred_at,status')
        .order('occurred_at', { ascending: false });
      setDeviations((data ?? []) as DeviationRow[]);
    })();
  }, []);

  const client = clients.find(c => c.id === selectedId);

  const clientProjects = useMemo(
    () => (client ? projects.filter(p => belongsToClient(p, client)) : []),
    [projects, client],
  );

  const results = useMemo(
    () =>
      clientProjects.map(p => ({
        project: p,
        result: computeProfitability(inputs[p.id] ?? emptyInput(p)),
      })),
    [clientProjects, inputs],
  );

  const totals = useMemo<Profitability | null>(() => {
    if (results.length === 0) return null;
    const sum = (pick: (r: Profitability) => number) =>
      results.reduce((s, r) => s + pick(r.result), 0);
    const revenue = sum(r => r.revenue);
    const grossMargin = sum(r => r.grossMargin);
    const contributionMargin = sum(r => r.contributionMargin);
    return {
      revenue,
      budgetHours: sum(r => r.budgetHours),
      actualHours: sum(r => r.actualHours),
      hoursVariance: sum(r => r.hoursVariance),
      internalCost: sum(r => r.internalCost),
      externalCost: sum(r => r.externalCost),
      travelCost: sum(r => r.travelCost),
      materialCost: sum(r => r.materialCost),
      otherCost: sum(r => r.otherCost),
      directCost: sum(r => r.directCost),
      totalCost: sum(r => r.totalCost),
      grossMargin,
      grossMarginPct: revenue > 0 ? (grossMargin / revenue) * 100 : 0,
      contributionMargin,
      contributionMarginPct: revenue > 0 ? (contributionMargin / revenue) * 100 : 0,
      profitabilityPct: revenue > 0 ? (contributionMargin / revenue) * 100 : 0,
      revenueIsFixedPrice: false,
    };
  }, [results]);

  const quotes = results.filter(r => QUOTE_STATUSES.includes(r.project.status));
  const invoices = results.filter(r => r.project.status === 'completed');
  const clientRefs = new Set(clientProjects.map(p => p.id));
  const clientDeviations = deviations.filter(d => clientRefs.has(d.project_ref));

  const attachments = clientProjects.flatMap(p =>
    (p.attachments ?? []).map(a => ({ ...a, projectName: p.name })),
  );

  const contacts = [
    ...(client?.mainContact?.name || client?.mainContact?.email || client?.mainContact?.phone
      ? [
          {
            key: 'main',
            name: client.mainContact?.name || 'Main contact',
            role: client.mainContact?.role || 'Main contact',
            phone: client.mainContact?.phone,
            email: client.mainContact?.email,
            source: 'Client register',
          },
        ]
      : []),
    ...clientProjects
      .filter(p => p.contactName || p.contactPhone || p.contactEmail)
      .map(p => ({
        key: p.id,
        name: p.contactName || 'Site contact',
        role: 'Site contact',
        phone: p.contactPhone,
        email: p.contactEmail,
        source: p.name,
      })),
  ];

  const serviceHistory = [
    ...clientProjects
      .filter(p => p.status === 'completed')
      .map(p => ({
        key: `p-${p.id}`,
        date: p.endDate || p.startDate || '',
        title: p.name,
        detail: `Completed · ${p.location || '—'}${reports[p.id]?.hasSignature ? ' · signed off' : ''}`,
      })),
    ...clientDeviations.map(d => ({
      key: `d-${d.id}`,
      date: d.occurred_at?.slice(0, 10) ?? '',
      title: `Deviation: ${d.category}`,
      detail: `${d.severity} · ${d.project_name ?? d.project_ref} · ${d.status}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (clients.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Add a client first to see the customer page.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-5 border-b border-border bg-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-secondary-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {client?.name ?? 'Customer 360'}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {[client?.street, client?.postalCode, client?.region].filter(Boolean).join(', ') ||
                'No office address'}
              {client?.customerNumber ? ` · Customer no. ${client.customerNumber}` : ''}
            </p>
          </div>
        </div>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
        >
          {clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Projects" value={`${clientProjects.length}`} />
          <Stat label="Revenue" value={totals ? sek(totals.revenue) : '—'} />
          <Stat
            label="Gross margin"
            value={totals ? pctLabel(totals.grossMarginPct) : '—'}
            tone={totals ? marginColor(marginLevel(totals.grossMarginPct)) : undefined}
          />
          <Stat label="Logged hours" value={totals ? `${Math.round(totals.actualHours)} h` : '—'} />
        </div>

        <Tabs defaultValue="projects">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="history">Service history</TabsTrigger>
            <TabsTrigger value="profitability">Profitability</TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <Panel title="Projects" icon={ClipboardList} empty="No orders for this customer yet.">
              {clientProjects.length > 0 ? (
                <div className="divide-y divide-border">
                  {clientProjects.map(p => (
                    <Row
                      key={p.id}
                      title={p.name}
                      subtitle={`${statusLabels[p.status]} · ${p.location || '—'}`}
                      right={`${p.startDate?.slice(0, 10) ?? ''} → ${p.endDate?.slice(0, 10) ?? ''}`}
                      rightSub={p.estimatedHours ? `${p.estimatedHours} h planned` : undefined}
                    />
                  ))}
                </div>
              ) : undefined}
            </Panel>
          </TabsContent>

          <TabsContent value="quotes" className="mt-4">
            <Panel
              title="Quoted / not yet started"
              icon={FileSignature}
              empty="Nothing quoted or waiting to start."
            >
              {quotes.length > 0 ? (
                <div className="divide-y divide-border">
                  {quotes.map(({ project, result }) => (
                    <Row
                      key={project.id}
                      title={project.name}
                      subtitle={`${statusLabels[project.status]} · ${result.budgetHours || 0} h budgeted`}
                      right={sek(result.revenue)}
                      rightSub="estimated value"
                    />
                  ))}
                </div>
              ) : undefined}
            </Panel>
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <Panel title="Ready to invoice" icon={Receipt} empty="No completed work to invoice.">
              {invoices.length > 0 ? (
                <div className="divide-y divide-border">
                  {invoices.map(({ project, result }) => (
                    <Row
                      key={project.id}
                      title={project.name}
                      subtitle={`Completed ${project.endDate?.slice(0, 10) ?? ''} · ${Math.round(result.actualHours)} h logged`}
                      right={sek(result.revenue)}
                      rightSub={
                        reports[project.id]?.hasSignature ? 'signed off' : 'awaiting sign-off'
                      }
                    />
                  ))}
                </div>
              ) : undefined}
            </Panel>
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <Panel title="Contacts" icon={User} empty="No contact details registered.">
              {contacts.length > 0 ? (
                <div className="divide-y divide-border">
                  {contacts.map(c => (
                    <div key={c.key} className="px-4 py-3">
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.role} · {c.source}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground">
                            <Phone className="w-3 h-3" />
                            {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground">
                            <Mail className="w-3 h-3" />
                            {c.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : undefined}
            </Panel>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <Panel title="Documents & files" icon={FileText} empty="No files attached to this customer's orders.">
              {attachments.length > 0 ? (
                <div className="divide-y divide-border">
                  {attachments.map(a => (
                    <Row
                      key={a.id}
                      title={a.name}
                      subtitle={a.projectName}
                      right={`${Math.round((a.size ?? 0) / 1024)} kB`}
                      rightSub={a.type}
                    />
                  ))}
                </div>
              ) : undefined}
            </Panel>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Panel title="Service history" icon={History} empty="No completed work or reported issues yet.">
              {serviceHistory.length > 0 ? (
                <div className="divide-y divide-border">
                  {serviceHistory.map(h => (
                    <Row key={h.key} title={h.title} subtitle={h.detail} right={h.date} />
                  ))}
                </div>
              ) : undefined}
            </Panel>
          </TabsContent>

          <TabsContent value="profitability" className="mt-4">
            <Panel title="Profitability" icon={TrendingUp} empty="No financial data for this customer yet.">
              {totals ? (
                <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat label="Revenue" value={sek(totals.revenue)} />
                  <Stat
                    label="Gross margin"
                    value={`${sek(totals.grossMargin)} (${pctLabel(totals.grossMarginPct)})`}
                    tone={marginColor(marginLevel(totals.grossMarginPct))}
                  />
                  <Stat
                    label="Contribution margin"
                    value={`${sek(totals.contributionMargin)} (${pctLabel(totals.contributionMarginPct)})`}
                    tone={marginColor(marginLevel(totals.contributionMarginPct))}
                  />
                  <Stat label="Total cost" value={sek(totals.totalCost)} />
                  <Stat label="Internal cost" value={sek(totals.internalCost)} />
                  <Stat label="External cost" value={sek(totals.externalCost)} />
                  <Stat label="Travel cost" value={sek(totals.travelCost)} />
                  <Stat label="Material cost" value={sek(totals.materialCost)} />
                </div>
              ) : undefined}
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Customer360;
