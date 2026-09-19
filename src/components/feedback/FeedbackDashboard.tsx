import { Bug, CheckCircle2, Lightbulb, ListTodo } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { feedbackStats, statusLabel, typeLabel, type FeedbackItem } from '@/lib/feedback';

const FeedbackDashboard = ({ items }: { items: FeedbackItem[] }) => {
  const stats = feedbackStats(items);

  const kpis = [
    { label: 'Öppna ärenden', value: stats.open, icon: ListTodo },
    { label: 'Lösta ärenden', value: stats.resolved, icon: CheckCircle2 },
    { label: 'Rapporterade buggar', value: (stats.byType.bug ?? 0) + (stats.byType.mobile ?? 0), icon: Bug },
    { label: 'Önskade funktioner', value: (stats.byType.feature ?? 0) + (stats.byType.improvement ?? 0), icon: Lightbulb },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <k.icon className="h-4 w-4" />
              {k.label}
            </div>
            <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Mest rapporterade buggar</h3>
          {stats.topBugs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Inga buggar rapporterade ännu.</p>
          ) : (
            <ol className="space-y-1.5">
              {stats.topBugs.map((b, i) => (
                <li key={b.id} className="flex items-start gap-2 text-sm">
                  <span className="w-4 shrink-0 text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{b.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{typeLabel(b.type)} · {statusLabel(b.status)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Mest efterfrågade funktioner</h3>
          {stats.topRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground">Inga förslag ännu.</p>
          ) : (
            <ol className="space-y-1.5">
              {stats.topRequests.map((r, i) => (
                <li key={r.id} className="flex items-start gap-2 text-sm">
                  <span className="w-4 shrink-0 text-muted-foreground">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{r.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-primary">{r.votes} röster</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Fördelning per status</h3>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(stats.byStatus) as Array<keyof typeof stats.byStatus>).map(s => (
            <div key={s}>
              <p className="text-xs text-muted-foreground">{statusLabel(s)}</p>
              <p className="text-lg font-semibold text-foreground">{stats.byStatus[s]}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default FeedbackDashboard;
