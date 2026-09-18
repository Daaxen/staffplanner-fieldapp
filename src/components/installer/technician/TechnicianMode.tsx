import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, Clock, HardHat, LayoutGrid, MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Installer, type Project } from '@/data/mockData';
import TechnicianJob from './TechnicianJob';

interface TechnicianModeProps {
  projects: Project[];
  installer: Installer;
  onStatusChange?: (projectId: string, newStatus: Project['status']) => void;
  onExit: () => void;
}

const TechnicianMode = ({ projects, installer, onStatusChange, onExit }: TechnicianModeProps) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  const todaysJobs = useMemo(
    () =>
      projects
        .filter(
          p =>
            p.assigneeIds.includes(installer.id) &&
            p.status !== 'cancelled' &&
            p.startDate.slice(0, 10) <= today &&
            p.endDate.slice(0, 10) >= today,
        )
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [projects, installer.id, today],
  );

  const open = todaysJobs.find(p => p.id === openId) ?? null;
  if (open) {
    return <TechnicianJob project={open} onBack={() => setOpenId(null)} onStatusChange={onStatusChange} />;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="shrink-0 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <HardHat className="w-5 h-5" /> Today
          </h1>
          <p className="text-xs opacity-80">{format(new Date(), 'EEEE d MMMM')} · {installer.name}</p>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-3 py-2 text-xs font-medium"
        >
          <LayoutGrid className="w-4 h-4" />
          Full app
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {todaysJobs.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-base font-medium text-foreground">No jobs today</p>
            <p className="text-sm text-muted-foreground mt-1">Enjoy the quiet — check the full app for later jobs.</p>
          </div>
        )}
        {todaysJobs.map(job => (
          <div key={job.id} className="rounded-2xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setOpenId(job.id)}
              className="w-full flex items-center gap-3 px-4 py-5 text-left active:bg-muted"
            >
              <span
                className={cn(
                  'w-2.5 self-stretch rounded-full shrink-0',
                  job.status === 'in-progress'
                    ? 'bg-status-in-progress'
                    : job.status === 'completed'
                      ? 'bg-status-completed'
                      : 'bg-status-scheduled',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-foreground truncate">{job.name}</span>
                <span className="mt-1 flex items-center gap-1 text-sm text-muted-foreground truncate">
                  <MapPin className="w-4 h-4 shrink-0" /> {job.location || 'No address'}
                </span>
                {(job.startTime || job.endTime) && (
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" /> {job.startTime ?? '--'}{job.endTime ? `–${job.endTime}` : ''}
                  </span>
                )}
              </span>
              <ChevronRight className="w-6 h-6 text-muted-foreground shrink-0" />
            </button>
            {job.location && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border-t border-border py-3.5 text-sm font-semibold text-primary active:bg-muted"
              >
                <Navigation className="w-4 h-4" /> Navigate
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TechnicianMode;
