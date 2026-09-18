import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Check, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEVIATION_CATEGORIES,
  DEVIATION_SEVERITIES,
  categoryLabel,
  fetchDeviations,
  severityLabel,
  signedPhotoUrl,
  updateDeviationStatus,
  type Deviation,
} from '@/lib/deviations';

const severityStyle: Record<string, string> = {
  low: 'border-status-scheduled/40 bg-status-scheduled/5',
  medium: 'border-status-in-progress/40 bg-status-in-progress/10',
  high: 'border-status-on-hold/50 bg-status-on-hold/10',
  critical: 'border-destructive/60 bg-destructive/10',
};

const DeviationsView = () => {
  const [items, setItems] = useState<Deviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'open' | 'all' | 'resolved'>('open');
  const [severity, setSeverity] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchDeviations());
    } catch {
      toast.error('Could not load deviations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    items.forEach(d =>
      d.photo_paths.forEach(path => {
        if (photoUrls[path]) return;
        void signedPhotoUrl(path).then(url => {
          if (url) setPhotoUrls(prev => ({ ...prev, [path]: url }));
        });
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const filtered = useMemo(
    () =>
      items.filter(d => {
        if (status === 'open' && d.status === 'resolved') return false;
        if (status === 'resolved' && d.status !== 'resolved') return false;
        if (severity !== 'all' && d.severity !== severity) return false;
        if (category !== 'all' && d.category !== category) return false;
        return true;
      }),
    [items, status, severity, category],
  );

  const resolve = async (d: Deviation) => {
    try {
      await updateDeviationStatus(d.id, d.status === 'resolved' ? 'open' : 'resolved');
      await load();
    } catch {
      toast.error('Could not update the deviation');
    }
  };

  return (
    <div className="p-6 overflow-auto">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-status-on-hold" />
            Deviations
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Problems reported from the field, with photos and time of the event.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <select
          value={status}
          onChange={e => setStatus(e.target.value as typeof status)}
          className="h-9 rounded-md border border-border bg-background px-2"
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2"
        >
          <option value="all">All severities</option>
          {DEVIATION_SEVERITIES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2"
        >
          <option value="all">All categories</option>
          {DEVIATION_CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No deviations to show.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <div key={d.id} className={cn('rounded-lg border p-3', severityStyle[d.severity] ?? 'border-border')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {categoryLabel(d.category)}
                    <span className="ml-2 text-xs font-medium uppercase text-muted-foreground">
                      {severityLabel(d.severity)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {d.project_name ?? d.project_ref}
                    {d.installer_name ? ` · ${d.installer_name}` : ''} ·{' '}
                    {format(new Date(d.occurred_at), 'd MMM yyyy HH:mm')}
                  </p>
                  <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{d.description}</p>
                </div>
                <Button
                  size="sm"
                  variant={d.status === 'resolved' ? 'outline' : 'default'}
                  onClick={() => void resolve(d)}
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {d.status === 'resolved' ? 'Reopen' : 'Resolve'}
                </Button>
              </div>
              {d.photo_paths.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.photo_paths.map(path => (
                    <a
                      key={path}
                      href={photoUrls[path]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-24 h-24 rounded-md overflow-hidden bg-muted flex items-center justify-center"
                    >
                      {photoUrls[path] ? (
                        <img src={photoUrls[path]} alt="Deviation" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeviationsView;
