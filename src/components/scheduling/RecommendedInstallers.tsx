import { Sparkles, MapPin, Clock, Briefcase, Wrench, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { InstallerRecommendation } from '@/lib/assignmentRecommendations';

const factorIcons = {
  distance: MapPin,
  travel: Clock,
  workload: Briefcase,
  skill: Wrench,
  availability: CalendarCheck,
} as const;

interface RecommendedInstallersProps {
  recommendations: InstallerRecommendation[];
  selectedIds: string[];
  onSelect: (installerId: string) => void;
  className?: string;
}

const RecommendedInstallers = ({ recommendations, selectedIds, onSelect, className }: RecommendedInstallersProps) => {
  const top = recommendations.filter(r => r.recommended);
  if (top.length === 0) return null;

  return (
    <div className={cn('rounded-md border border-input bg-muted/40 p-3', className)}>
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">Recommended for this job</span>
        <span className="text-[10px] text-muted-foreground ml-auto">You can still pick anyone</span>
      </div>

      <div className="grid gap-2">
        {top.map(rec => {
          const selected = selectedIds.includes(rec.installer.id);
          return (
            <div key={rec.installer.id} className="rounded border border-border bg-background p-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground w-4">#{rec.rank}</span>
                <span className="text-sm font-medium">{rec.installer.name}</span>
                <span className="text-[10px] text-muted-foreground">{rec.score}% match</span>
                <Button
                  type="button"
                  size="sm"
                  variant={selected ? 'secondary' : 'outline'}
                  className="ml-auto h-6 text-[11px] px-2"
                  onClick={() => onSelect(rec.installer.id)}
                >
                  {selected ? 'Selected' : 'Assign'}
                </Button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {rec.factors.map(f => {
                  const Icon = factorIcons[f.id];
                  return (
                    <span
                      key={f.id}
                      className={cn(
                        'flex items-center gap-1 text-[10px]',
                        f.score >= 70
                          ? 'text-status-completed'
                          : f.score >= 40
                            ? 'text-status-on-hold'
                            : 'text-muted-foreground',
                      )}
                      title={f.label}
                    >
                      <Icon className="h-3 w-3" />
                      {f.detail}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecommendedInstallers;
