import { useMemo, useState } from 'react';
import { format, addDays, startOfWeek, isSameDay, isToday, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, MapPin, Clock } from 'lucide-react';
import { type Project, type Installer, projectTypeIcons, statusLabels } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface InstallerScheduleProps {
  projects: Project[];
  installer: Installer;
  onSelectProject: (project: Project) => void;
  listMode?: boolean;
}

const statusColorMap: Record<string, string> = {
  'scheduled': 'bg-status-scheduled/15 border-status-scheduled',
  'in-progress': 'bg-status-in-progress/15 border-status-in-progress',
  'completed': 'bg-status-completed/15 border-status-completed',
  'on-hold': 'bg-status-on-hold/15 border-status-on-hold',
  'cancelled': 'bg-status-cancelled/15 border-status-cancelled',
  'open': 'bg-status-open/15 border-status-open',
};

const statusDotMap: Record<string, string> = {
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
  'open': 'bg-status-open',
};

const InstallerSchedule = ({ projects, installer, onSelectProject, listMode }: InstallerScheduleProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>('week');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const navigateDate = (direction: number) => {
    if (view === 'day') {
      setCurrentDate(prev => addDays(prev, direction));
    } else {
      setCurrentDate(prev => addDays(prev, direction * 7));
    }
  };

  const getProjectsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return projects.filter(p => dayStr >= p.startDate && dayStr <= p.endDate && p.status !== 'cancelled');
  };

  const getAbsenceForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return installer.absences.find(a => dayStr >= a.startDate && dayStr <= a.endDate);
  };

  // List mode: show all active projects
  if (listMode) {
    const activeProjects = projects
      .filter(p => p.status !== 'cancelled' && p.status !== 'completed')
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    const completedProjects = projects
      .filter(p => p.status === 'completed')
      .sort((a, b) => b.endDate.localeCompare(a.endDate));

    return (
      <div className="p-4 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Active Projects ({activeProjects.length})</h2>
        {activeProjects.map(project => (
          <ProjectCard key={project.id} project={project} onSelect={onSelectProject} />
        ))}
        {completedProjects.length > 0 && (
          <>
            <h2 className="text-base font-semibold text-muted-foreground mt-6">Completed ({completedProjects.length})</h2>
            {completedProjects.map(project => (
              <ProjectCard key={project.id} project={project} onSelect={onSelectProject} />
            ))}
          </>
        )}
      </div>
    );
  }

  // Day view
  if (view === 'day') {
    const dayProjects = getProjectsForDay(currentDate);
    const absence = getAbsenceForDay(currentDate);

    return (
      <div className="flex flex-col h-full">
        {/* Day Navigation */}
        <div className="px-4 py-3 bg-card border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => navigateDate(-1)} className="p-2 rounded-lg hover:bg-muted">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">{format(currentDate, 'EEEE')}</p>
              <p className="text-xs text-muted-foreground">{format(currentDate, 'MMMM d, yyyy')}</p>
            </div>
            <button onClick={() => navigateDate(1)} className="p-2 rounded-lg hover:bg-muted">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('day')} className="flex-1 text-xs font-medium py-1.5 rounded-md bg-primary text-primary-foreground">Day</button>
            <button onClick={() => setView('week')} className="flex-1 text-xs font-medium py-1.5 rounded-md bg-muted text-muted-foreground">Week</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {absence && (
            <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                {absence.type === 'vacation' ? '🏖️' : absence.type === 'sick' ? '🤒' : '📅'} {absence.label || absence.type}
              </p>
            </div>
          )}
          {dayProjects.length === 0 && !absence && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No projects scheduled</p>
            </div>
          )}
          {dayProjects.map(project => (
            <ProjectCard key={project.id} project={project} onSelect={onSelectProject} />
          ))}
        </div>
      </div>
    );
  }

  // Week view (default)
  return (
    <div className="flex flex-col h-full">
      {/* Week Navigation */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigateDate(-1)} className="p-2 rounded-lg hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </p>
          </div>
          <button onClick={() => navigateDate(1)} className="p-2 rounded-lg hover:bg-muted">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('day')} className="flex-1 text-xs font-medium py-1.5 rounded-md bg-muted text-muted-foreground">Day</button>
          <button onClick={() => setView('week')} className="flex-1 text-xs font-medium py-1.5 rounded-md bg-primary text-primary-foreground">Week</button>
        </div>
      </div>

      {/* Week Day Strips */}
      <div className="flex-1 overflow-auto">
        {weekDays.map(day => {
          const dayProjects = getProjectsForDay(day);
          const absence = getAbsenceForDay(day);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-b border-border px-4 py-2",
                today && "bg-primary/5"
              )}
              onClick={() => { setCurrentDate(day); setView('day'); }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center",
                  today ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}>
                  {format(day, 'd')}
                </span>
                <span className={cn("text-xs", today ? "text-foreground font-semibold" : "text-muted-foreground")}>
                  {format(day, 'EEE')}
                </span>
                {absence && (
                  <span className="text-xs text-destructive ml-auto">
                    {absence.type === 'vacation' ? '🏖️' : '🤒'} {absence.label}
                  </span>
                )}
              </div>
              {dayProjects.length === 0 && !absence && (
                <p className="text-xs text-muted-foreground/50 ml-9">—</p>
              )}
              {dayProjects.map(project => (
                <div
                  key={project.id}
                  className={cn(
                    "ml-9 mb-1 rounded-md border-l-[3px] px-2 py-1.5 flex items-center gap-2",
                    statusColorMap[project.status]
                  )}
                  onClick={(e) => { e.stopPropagation(); onSelectProject(project); }}
                >
                  <span className="text-xs">{projectTypeIcons[project.projectType]}</span>
                  <span className="text-xs font-medium text-foreground truncate flex-1">{project.name}</span>
                  {project.startTime && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{project.startTime}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Shared project card component
const ProjectCard = ({ project, onSelect }: { project: Project; onSelect: (p: Project) => void }) => (
  <div
    className={cn(
      "rounded-xl border-l-[4px] bg-card p-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer",
      statusColorMap[project.status]?.split(' ')[1] || 'border-border'
    )}
    onClick={() => onSelect(project)}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">
          {projectTypeIcons[project.projectType]} {project.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{project.client}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={cn("w-2 h-2 rounded-full", statusDotMap[project.status])} />
        <span className="text-[10px] text-muted-foreground">{statusLabels[project.status]}</span>
      </div>
    </div>
    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{project.location}</span>
      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{project.startDate} → {project.endDate}</span>
    </div>
  </div>
);

export default InstallerSchedule;
