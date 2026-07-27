import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { clientRegister, projects, type Client } from '@/data/mockData';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Building2, Search, MapPin, Copy, Download, Upload, Plus, Pencil, User, Receipt,
} from 'lucide-react';
import { toast } from 'sonner';

// Numeric-only auto-id generator
function nextId(existing: Client[]): string {
  const max = existing
    .map((c) => parseInt(c.id, 10))
    .filter((n) => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 1000);
  return String(max + 1);
}

const emptyClient = (id: string): Client => ({
  id,
  customerNumber: '',
  name: '',
  street: '', postalCode: '', region: '',
  mainContact: { name: '', role: '', phone: '', email: '' },
  invoicing: {
    billingName: '', billingStreet: '', billingPostalCode: '', billingCity: '',
    billingCountry: 'SE', vatNumber: '', orgNumber: '', invoiceEmail: '',
    paymentTermsDays: 30, reference: '',
  },
});

const ClientsRegister = () => {
  const [clients, setClients] = useState<Client[]>(() => [...clientRegister]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients
      .map((c) => {
        const cp = projects.filter((p) => p.clientId === c.id);
        return {
          ...c,
          projectCount: cp.length,
          activeCount: cp.filter((p) => p.status !== 'completed' && p.status !== 'cancelled').length,
        };
      })
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.includes(q) ||
        (c.customerNumber ?? '').toLowerCase().includes(q) ||
        (c.street ?? '').toLowerCase().includes(q) ||
        (c.postalCode ?? '').toLowerCase().includes(q) ||
        (c.region ?? '').toLowerCase().includes(q)
      );
  }, [query, clients]);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success(`Copied ${id}`);
  };

  const openNew = () => setEditing(emptyClient(nextId(clients)));
  const openEdit = (c: Client) => setEditing(JSON.parse(JSON.stringify(c)));

  const saveEditing = () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Name is required'); return; }
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === editing.id);
      if (idx === -1) return [...prev, editing];
      const next = [...prev]; next[idx] = editing; return next;
    });
    toast.success(`Saved ${editing.name}`);
    setEditing(null);
  };

  // ---- Export ----
  const exportXlsx = () => {
    const data = clients.map((c) => ({
      'Client ID': c.id,
      'Customer Number': c.customerNumber ?? '',
      'Name': c.name,
      'Office Street': c.street ?? '',
      'Office Postal Code': c.postalCode ?? '',
      'Office Region': c.region ?? '',
      'Contact Name': c.mainContact?.name ?? '',
      'Contact Role': c.mainContact?.role ?? '',
      'Contact Phone': c.mainContact?.phone ?? '',
      'Contact Email': c.mainContact?.email ?? '',
      'Billing Name': c.invoicing?.billingName ?? '',
      'Billing Street': c.invoicing?.billingStreet ?? '',
      'Billing Postal Code': c.invoicing?.billingPostalCode ?? '',
      'Billing City': c.invoicing?.billingCity ?? '',
      'Billing Country': c.invoicing?.billingCountry ?? '',
      'VAT Number': c.invoicing?.vatNumber ?? '',
      'Org Number': c.invoicing?.orgNumber ?? '',
      'Invoice Email': c.invoicing?.invoiceEmail ?? '',
      'Payment Terms (days)': c.invoicing?.paymentTermsDays ?? '',
      'Invoice Reference': c.invoicing?.reference ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, `clients-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadTemplate = () => {
    const headers = [{
      'Client ID': '', 'Customer Number': 'CUST-001', 'Name': 'Example AB',
      'Office Street': 'Storgatan 1', 'Office Postal Code': '111 22', 'Office Region': 'Stockholm',
      'Contact Name': 'Anna Andersson', 'Contact Role': 'Facility Manager',
      'Contact Phone': '+46 70 000 0000', 'Contact Email': 'anna@example.se',
      'Billing Name': 'Example AB', 'Billing Street': 'Box 1',
      'Billing Postal Code': '111 22', 'Billing City': 'Stockholm', 'Billing Country': 'SE',
      'VAT Number': 'SE556000000001', 'Org Number': '556000-0000',
      'Invoice Email': 'invoices@example.se', 'Payment Terms (days)': 30, 'Invoice Reference': 'PO-1234',
    }];
    const ws = XLSX.utils.json_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'clients-import-template.xlsx');
  };

  // ---- Import ----
  const onImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      let created = 0, updated = 0;
      setClients((prev) => {
        const next = [...prev];
        for (const r of raw) {
          const name = String(r['Name'] ?? '').trim();
          if (!name) continue;
          const idIn = String(r['Client ID'] ?? '').trim();
          const paymentTerms = r['Payment Terms (days)'];
          const payload: Client = {
            id: idIn || nextId(next),
            customerNumber: String(r['Customer Number'] ?? '').trim() || undefined,
            name,
            street: String(r['Office Street'] ?? '').trim() || undefined,
            postalCode: String(r['Office Postal Code'] ?? '').trim() || undefined,
            region: String(r['Office Region'] ?? '').trim() || undefined,
            mainContact: {
              name: String(r['Contact Name'] ?? '').trim() || undefined,
              role: String(r['Contact Role'] ?? '').trim() || undefined,
              phone: String(r['Contact Phone'] ?? '').trim() || undefined,
              email: String(r['Contact Email'] ?? '').trim() || undefined,
            },
            invoicing: {
              billingName: String(r['Billing Name'] ?? '').trim() || undefined,
              billingStreet: String(r['Billing Street'] ?? '').trim() || undefined,
              billingPostalCode: String(r['Billing Postal Code'] ?? '').trim() || undefined,
              billingCity: String(r['Billing City'] ?? '').trim() || undefined,
              billingCountry: String(r['Billing Country'] ?? '').trim() || undefined,
              vatNumber: String(r['VAT Number'] ?? '').trim() || undefined,
              orgNumber: String(r['Org Number'] ?? '').trim() || undefined,
              invoiceEmail: String(r['Invoice Email'] ?? '').trim() || undefined,
              paymentTermsDays: paymentTerms === '' || paymentTerms == null ? undefined : Number(paymentTerms),
              reference: String(r['Invoice Reference'] ?? '').trim() || undefined,
            },
          };
          const idx = idIn ? next.findIndex((c) => c.id === idIn) : -1;
          if (idx >= 0) { next[idx] = { ...next[idx], ...payload }; updated++; }
          else { next.push(payload); created++; }
        }
        return next;
      });
      toast.success(`Import complete — ${created} created, ${updated} updated`);
    } catch (e: any) {
      toast.error(`Import failed: ${e.message ?? e}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Building2 className="w-6 h-6" /> Clients
            </h1>
            <p className="text-sm text-muted-foreground">
              {clients.length} clients in register · Office address only (project addresses live on each order)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, ID, customer #…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-1.5" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}>
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1.5" /> Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
            <Button size="sm" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1.5" /> New client
            </Button>
          </div>
        </div>

        <div className="border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Client</th>
                <th className="text-left px-4 py-2 font-medium">ID</th>
                <th className="text-left px-4 py-2 font-medium">Customer #</th>
                <th className="text-left px-4 py-2 font-medium">Office Address</th>
                <th className="text-left px-4 py-2 font-medium">Main Contact</th>
                <th className="text-right px-4 py-2 font-medium">Projects</th>
                <th className="text-right px-4 py-2 font-medium">Active</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copyId(c.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded bg-muted hover:bg-muted/70"
                    >
                      {c.id}
                      <Copy className="w-3 h-3" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.customerNumber || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.street ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {c.street}{c.postalCode ? `, ${c.postalCode}` : ''}{c.region ? `, ${c.region}` : ''}
                      </span>
                    ) : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.mainContact?.name ? (
                      <div className="flex flex-col">
                        <span>{c.mainContact.name}</span>
                        {c.mainContact.phone && <span className="text-xs">{c.mainContact.phone}</span>}
                      </div>
                    ) : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">{c.projectCount}</td>
                  <td className="px-4 py-3 text-right">
                    {c.activeCount > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {c.activeCount}
                      </span>
                    ) : <span className="text-muted-foreground/60">0</span>}
                  </td>
                  <td className="px-2 py-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No clients match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / New dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing && clients.some((c) => c.id === editing.id) ? 'Edit client' : 'New client'}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Client ID (auto)</Label>
                  <Input value={editing.id} readOnly className="bg-muted font-mono" />
                </div>
                <div>
                  <Label>Customer Number</Label>
                  <Input
                    value={editing.customerNumber ?? ''}
                    onChange={(e) => setEditing({ ...editing, customerNumber: e.target.value })}
                    placeholder="Free text — e.g. CUST-001"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Name *</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
              </div>

              <section>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <MapPin className="w-4 h-4" /> Office Address
                </h3>
                <p className="text-xs text-muted-foreground mb-2">Client's head office. Project sites are set per order.</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <Label>Street</Label>
                    <Input value={editing.street ?? ''} onChange={(e) => setEditing({ ...editing, street: e.target.value })} />
                  </div>
                  <div>
                    <Label>Postal Code</Label>
                    <Input value={editing.postalCode ?? ''} onChange={(e) => setEditing({ ...editing, postalCode: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>Region / City</Label>
                    <Input value={editing.region ?? ''} onChange={(e) => setEditing({ ...editing, region: e.target.value })} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <User className="w-4 h-4" /> Main Contact
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={editing.mainContact?.name ?? ''}
                      onChange={(e) => setEditing({ ...editing, mainContact: { ...editing.mainContact, name: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Input
                      value={editing.mainContact?.role ?? ''}
                      onChange={(e) => setEditing({ ...editing, mainContact: { ...editing.mainContact, role: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={editing.mainContact?.phone ?? ''}
                      onChange={(e) => setEditing({ ...editing, mainContact: { ...editing.mainContact, phone: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editing.mainContact?.email ?? ''}
                      onChange={(e) => setEditing({ ...editing, mainContact: { ...editing.mainContact, email: e.target.value } })}
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Receipt className="w-4 h-4" /> Invoicing
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Billing Name</Label>
                    <Input
                      value={editing.invoicing?.billingName ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, billingName: e.target.value } })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Billing Street</Label>
                    <Input
                      value={editing.invoicing?.billingStreet ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, billingStreet: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Postal Code</Label>
                    <Input
                      value={editing.invoicing?.billingPostalCode ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, billingPostalCode: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input
                      value={editing.invoicing?.billingCity ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, billingCity: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input
                      value={editing.invoicing?.billingCountry ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, billingCountry: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Org. Number</Label>
                    <Input
                      value={editing.invoicing?.orgNumber ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, orgNumber: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>VAT Number</Label>
                    <Input
                      value={editing.invoicing?.vatNumber ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, vatNumber: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Invoice Email</Label>
                    <Input
                      type="email"
                      value={editing.invoicing?.invoiceEmail ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, invoiceEmail: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Payment Terms (days)</Label>
                    <Input
                      type="number"
                      value={editing.invoicing?.paymentTermsDays ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, paymentTermsDays: e.target.value === '' ? undefined : Number(e.target.value) } })}
                    />
                  </div>
                  <div>
                    <Label>Reference / PO</Label>
                    <Input
                      value={editing.invoicing?.reference ?? ''}
                      onChange={(e) => setEditing({ ...editing, invoicing: { ...editing.invoicing, reference: e.target.value } })}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEditing}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsRegister;
