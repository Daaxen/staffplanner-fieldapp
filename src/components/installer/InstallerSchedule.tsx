import { useState, useMemo } from 'react';
import { format, addDays, addMonths, startOfWeek, startOfMonth, endOfMonth, isSameDay, isToday, isSameMonth, eachDayOfInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { type Project, type Installer, projectTypeIcons, statusLabels } from '@/data/mockData';
import { cn } from '@/lib/utils';
import ProjectCard from '@/components/installer/schedule/ProjectCard';
import ScheduleFilters, { type FilterState } from '@/components/installer/schedule/ScheduleFilters';
import InstallerOrderBox from '@/components/installer/schedule/InstallerOrderBox';

interface InstallerScheduleProps {
  projects: Project[];
  allProjects?: Project[];
  installer: Installer;
  onSelectProject: (project: Project) => void;
  onPickUpProject?: (project: Project) => void;
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

function applyFilters(projects: Project[], filters: FilterState): Project[] {
  let result = projects;
  if (filters.statuses.length > 0) {
    result = result.filter(p => filters.statuses.includes(p.status));
  }
  if (filters.types.length > 0) {
    result = result.filter(p => filters.types.includes(p.projectType));
  }
  result = [...result].sort((a, b) => {
    if (filters.sortBy === 'client') return a.client.localeCompare(b.client);
    if (filters.sortBy === 'status') return a.status.localeCompare(b.status);
    return a.startDate.localeCompare(b.startDate);
  });
  return result;
}

const InstallerSchedule = ({ projects, allProjects, installer, onSelectProject, onPickUpProject, listMode }: InstallerScheduleProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [filters, setFilters] = useState<FilterState>({ statuses: [], types: [], sortBy: 'date' });

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const navigateDate = (direction: number) => {
    if (view === 'day') setCurrentDate(prev => addDays(prev, direction));
    else if (view === 'week') setCurrentDate(prev => addDays(prev, direction * 7));
    else setCurrentDate(prev => addMonths(prev, direction));
  };

  const getProjectsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return projects.filter(p => dayStr >= p.startDate && dayStr <= p.endDate && p.status !== 'cancelled');
  };

  const getAbsenceForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return installer.absences.find(a => dayStr >= a.startDate && dayStr <= a.endDate);
  };

  const filteredProjects = useMemo(() => applyFilters(projects, filters), [projects, filters]);

  // List mode
  if (listMode) {
    const activeProjects = filteredProjects.filter(p => p.status !== 'cancelled' && p.status !== 'completed');
    const completedProjects = filteredProjects.filter(p => p.status === 'completed');

    return (
      <div className="flex flex-col h-full">
        <ScheduleFilters filters={filters} onChange={setFilters} />
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {allProjects && onPickUpProject && (
            <InstallerOrderBox projects={allProjects} onPickUp={onPickUpProject} />
          )}
          <h2 className="text-base font-semibold text-foreground">Active ({activeProjects.length})</h2>
          {activeProjects.map(project => (
            <ProjectCard key={project.id} project={project} onSelect={onSelectProject} currentInstallerId={installer.id} />
          ))}
          {completedProjects.length > 0 && (
            <>
              <h2 className="text-base font-semibold text-muted-foreground mt-4">Completed ({completedProjects.length})</h2>
              {completedProjects.map(project => (
                <ProjectCard key={project.id} project={project} onSelect={onSelectProject} currentInstallerId={installer.id} />
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  const navLabel = view === 'day'
    ? format(currentDate, 'EEEE, MMMM d, yyyy')
    : view === 'week'
    ? `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
    : format(currentDate, 'MMMM yyyy');

  // Month view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = addDays(startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 }), -1);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd > monthEnd ? addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6) : monthEnd });
    // Ensure full weeks
    const allDays = eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, Math.ceil(days.length / 7) * 7 - 1) });

    return (
      <div className="flex-1 overflow-auto p-2">
        <div className="grid grid-cols-7 gap-px mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-[10px] font-semibold text-muted-foreground text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {allDays.map(day => {
            const dayProjects = getProjectsForDay(day);
            const absence = getAbsenceForDay(day);
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[72px] p-1 rounded-md border border-transparent cursor-pointer transition-colors",
                  !inMonth && "opacity-30",
                  today && "bg-primary/10 border-primary/30",
                  inMonth && !today && "hover:bg-muted/50"
                )}
                onClick={() => { setCurrentDate(day); setView('day'); }}
              >
                <span className={cn(
                  "text-[10px] font-bold block text-center mb-0.5",
                  today ? "text-primary" : "text-foreground"
                )}>
                  {format(day, 'd')}
                </span>
                {absence && <div className="text-[8px] text-center">🏖️</div>}
                {dayProjects.slice(0, 2).map(p => (
                  <div key={p.id} className={cn("h-1.5 rounded-full mb-0.5", statusDotMap[p.status])} />
                ))}
                {dayProjects.length > 2 && (
                  <span className="text-[8px] text-muted-foreground text-center block">+{dayProjects.length - 2}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Day view content
  const renderDayView = () => {
    const dayProjects = applyFilters(getProjectsForDay(currentDate), filters);
    const absence = getAbsenceForDay(currentDate);

    return (
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {allProjects && onPickUpProject && (
          <InstallerOrderBox projects={allProjects} onPickUp={onPickUpProject} />
        )}
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
          <ProjectCard key={project.id} project={project} onSelect={onSelectProject} currentInstallerId={installer.id} />
        ))}
      </div>
    );
  };

  // Week view content
  const renderWeekView = () => (
    <div className="flex-1 overflow-auto">
      {allProjects && onPickUpProject && (
        <div className="pt-3">
          <InstallerOrderBox projects={allProjects} onPickUp={onPickUpProject} />
        </div>
      )}
      {weekDays.map(day => {
        const dayProjects = getProjectsForDay(day);
        const absence = getAbsenceForDay(day);
        const today = isToday(day);

        return (
          <div
            key={day.toISOString()}
            className={cn("border-b border-border px-4 py-2", today && "bg-primary/5")}
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
                  "ml-9 mb-1 rounded-md border-l-[3px] px-2 py-1.5",
                  statusColorMap[project.status]
                )}
                onClick={(e) => { e.stopPropagation(); onSelectProject(project); }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs">{projectTypeIcons[project.projectType]}</span>
                  <span className="text-xs font-medium text-foreground truncate flex-1">{project.name}</span>
                  {project.startTime && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{project.startTime}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground ml-4 truncate">{project.client} · {project.location}</span>
                  {project.estimatedHours && (
                    <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />{project.estimatedHours}h
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Navigation */}
      <div className="px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigateDate(-1)} className="p-2 rounded-lg hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">{navLabel}</p>
          </div>
          <button onClick={() => navigateDate(1)} className="p-2 rounded-lg hover:bg-muted">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex-1 text-xs font-medium py-1.5 rounded-md capitalize",
                view === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <ScheduleFilters filters={filters} onChange={setFilters} />

      {view === 'month' && renderMonthView()}
      {view === 'day' && renderDayView()}
      {view === 'week' && renderWeekView()}
    </div>
  );
};

export default InstallerSchedule;
