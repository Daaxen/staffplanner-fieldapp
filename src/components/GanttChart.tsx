import { useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, LayoutList, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { projects as initialProjects, installers, type Project, type ProjectStatus } from '@/data/mockData';
import ProjectDetailPanel from './ProjectDetailPanel';
import ProjectsView from './gantt/ProjectsView';
import InstallersView from './gantt/InstallersView';
import StatusFilter from './gantt/StatusFilter';

type ViewMode = 'day' | 'week' | 'month';
type GanttMode = 'projects' | 'installers';

const allStatuses: ProjectStatus[] = ['open', 'scheduled', 'in-progress', 'completed', 'on-hold', 'cancelled'];

const GanttChart = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [ganttMode, setGanttMode] = useState<GanttMode>('projects');
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<Project[]>(initialProjects);
  const [activeStatuses, setActiveStatuses] = useState<Set<ProjectStatus>>(new Set(allStatuses));

  const { days, startDate } = useMemo(() => {
    const today = new Date();
    let numDays: number;
    let start: Date;

    switch (viewMode) {
      case 'day':
        numDays = 3;
        start = new Date(today);
        start.setDate(start.getDate() + dateOffset);
        break;
      case 'week':
        numDays = 14;
        start = new Date(today);
        start.setDate(start.getDate() - today.getDay() + 1 + dateOffset * 7);
        break;
      case 'month':
        numDays = 31;
        start = new Date(today.getFullYear(), today.getMonth() + dateOffset, 1);
        break;
      default:
        numDays = 14;
        start = new Date(today);
    }

    const daysArr = Array.from({ length: numDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });

    return { days: daysArr, startDate: start };
  }, [viewMode, dateOffset]);

  const todayStr = new Date().toISOString().split('T')[0];
  const colWidth = viewMode === 'day' ? 200 : viewMode === 'week' ? 80 : 50;

  const viewLabel = useMemo(() => {
    if (days.length === 0) return '';
    const first = days[0];
    const last = days[days.length - 1];
    return `${first.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [days]);

  const getInstaller = (id: string | null) => id ? installers.find(i => i.id === id) ?? null : null;

  const handleDropProject = useCallback((projectId: string, installerId: string) => {
    setProjectsList(prev => prev.map(p =>
      p.id === projectId
        ? {
            ...p,
            assigneeIds: p.assigneeIds.includes(installerId) ? p.assigneeIds : [...p.assigneeIds, installerId],
            status: p.status === 'open' ? 'scheduled' as ProjectStatus : p.status,
          }
        : p
    ));
  }, []);

  const handleToggleStatus = useCallback((status: ProjectStatus) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  const handleShowAll = useCallback(() => {
    setActiveStatuses(new Set(allStatuses));
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Installation Planner</h2>
            <p className="text-sm text-muted-foreground">{viewLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Gantt mode toggle */}
          <div className="flex bg-secondary rounded-lg p-1">
            <button
              onClick={() => setGanttMode('projects')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                ganttMode === 'projects' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="w-3.5 h-3.5" />
              Projects
            </button>
            <button
              onClick={() => setGanttMode('installers')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                ganttMode === 'installers' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Installers
            </button>
          </div>

          <div className="w-px h-6 bg-border" />

          {/* View mode toggle */}
          <div className="flex bg-secondary rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); setDateOffset(0); }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                  viewMode === mode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => setDateOffset(d => d - 1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={() => setDateOffset(0)} className="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
              Today
            </button>
            <button onClick={() => setDateOffset(d => d + 1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive status filter */}
      <StatusFilter
        activeStatuses={activeStatuses}
        onToggleStatus={handleToggleStatus}
        onShowAll={handleShowAll}
      />

      {/* Gantt body */}
      {ganttMode === 'projects' ? (
        <ProjectsView
          projects={projectsList}
          days={days}
          colWidth={colWidth}
          startDate={startDate}
          todayStr={todayStr}
          onSelectProject={setSelectedProject}
          activeStatuses={activeStatuses}
          viewMode={viewMode}
        />
      ) : (
        <InstallersView
          projects={projectsList}
          installers={installers}
          days={days}
          colWidth={colWidth}
          startDate={startDate}
          todayStr={todayStr}
          onSelectProject={setSelectedProject}
          onDropProject={handleDropProject}
          activeStatuses={activeStatuses}
          viewMode={viewMode}
        />
      )}

      {/* Detail panel */}
      {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          installer={getInstaller(selectedProject.assigneeIds[0] ?? null)}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
};

export default GanttChart;
