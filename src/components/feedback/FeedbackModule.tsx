import { useMemo, useState } from 'react';
import { MessageSquarePlus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useFeedback } from '@/hooks/useFeedback';
import { FEEDBACK_STATUSES, type FeedbackStatus } from '@/lib/feedback';
import FeedbackCard from './FeedbackCard';
import FeedbackDashboard from './FeedbackDashboard';
import FeedbackForm from './FeedbackForm';

interface Props {
  /** Where the user was when reporting, e.g. the current admin view or installer tab. */
  view?: string;
  /** Compact layout for the mobile installer app. */
  compact?: boolean;
  orderNumber?: string | null;
  projectNumber?: string | null;
}

const FeedbackModule = ({ view, compact = false, orderNumber, projectNumber }: Props) => {
  const { items, loading, error, reload, create, toggleVote, setStatus, isAdmin } = useFeedback();
  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState<string>(isAdmin && !compact ? 'dashboard' : 'all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      (i.reporter_name ?? '').toLowerCase().includes(q));
  }, [items, query]);

  const forStatus = (s: FeedbackStatus) => filtered.filter(i => i.status === s);

  const changeStatus = async (id: string, status: FeedbackStatus) => {
    const err = await setStatus(id, status);
    if (err) toast.error(`Kunde inte uppdatera status: ${err}`);
    else toast.success('Status uppdaterad.');
  };

  const list = (rows: typeof items) => (
    rows.length === 0
      ? <p className="py-8 text-center text-sm text-muted-foreground">Inga ärenden här.</p>
      : (
        <div className="space-y-2">
          {rows.map(i => (
            <FeedbackCard
              key={i.id}
              item={i}
              isAdmin={isAdmin}
              onVote={toggleVote}
              onStatus={isAdmin ? changeStatus : undefined}
            />
          ))}
        </div>
      )
  );

  return (
    <div className={compact ? 'flex h-full flex-col' : 'flex flex-1 flex-col overflow-hidden'}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <div className="mr-auto">
          <h2 className="text-base font-semibold text-foreground">Feedback &amp; Förbättringar</h2>
          <p className="text-xs text-muted-foreground">Rapportera buggar och föreslå förbättringar av StaffPlanner.</p>
        </div>
        {!compact && (
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Sök…"
            className="h-9 w-48"
          />
        )}
        <Button variant="outline" size="sm" onClick={() => void reload()} aria-label="Uppdatera">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" />
          Ny feedback
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {error && <p className="mb-3 text-sm text-destructive">Kunde inte hämta feedback: {error}</p>}
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Hämtar feedback…</p>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3 flex w-full flex-wrap justify-start">
              {isAdmin && !compact && <TabsTrigger value="dashboard">Översikt</TabsTrigger>}
              <TabsTrigger value="all">Alla ({filtered.length})</TabsTrigger>
              {FEEDBACK_STATUSES.map(s => (
                <TabsTrigger key={s.value} value={s.value}>
                  {s.label} ({forStatus(s.value).length})
                </TabsTrigger>
              ))}
            </TabsList>

            {isAdmin && !compact && (
              <TabsContent value="dashboard"><FeedbackDashboard items={items} /></TabsContent>
            )}
            <TabsContent value="all">{list(filtered)}</TabsContent>
            {FEEDBACK_STATUSES.map(s => (
              <TabsContent key={s.value} value={s.value}>{list(forStatus(s.value))}</TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      <FeedbackForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={create}
        view={view}
        orderNumber={orderNumber}
        projectNumber={projectNumber}
      />
    </div>
  );
};

export default FeedbackModule;
