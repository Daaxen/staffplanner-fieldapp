import { useMemo, useState } from 'react';
import { clientRegister, projects } from '@/data/mockData';
import { Input } from '@/components/ui/input';
import { Building2, Search, MapPin, Copy } from 'lucide-react';
import { toast } from 'sonner';

const ClientsRegister = () => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clientRegister
      .map((c) => {
        const clientProjects = projects.filter((p) => p.clientId === c.id);
        return {
          ...c,
          projectCount: clientProjects.length,
          activeCount: clientProjects.filter((p) => p.status !== 'completed' && p.status !== 'cancelled').length,
        };
      })
      .filter((c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.street ?? '').toLowerCase().includes(q) ||
        (c.postalCode ?? '').toLowerCase().includes(q) ||
        (c.region ?? '').toLowerCase().includes(q)
      );
  }, [query]);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success(`Copied ${id}`);
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Building2 className="w-6 h-6" /> Clients
            </h1>
            <p className="text-sm text-muted-foreground">
              {clientRegister.length} clients in register
            </p>
          </div>
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, ID, address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Client</th>
                <th className="text-left px-4 py-2 font-medium">ID</th>
                <th className="text-left px-4 py-2 font-medium">Address</th>
                <th className="text-left px-4 py-2 font-medium">Region</th>
                <th className="text-right px-4 py-2 font-medium">Projects</th>
                <th className="text-right px-4 py-2 font-medium">Active</th>
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.street ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {c.street}
                        {c.postalCode ? `, ${c.postalCode}` : ''}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.region ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{c.projectCount}</td>
                  <td className="px-4 py-3 text-right">
                    {c.activeCount > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {c.activeCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">0</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No clients match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientsRegister;
