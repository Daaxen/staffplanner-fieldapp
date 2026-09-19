import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, LayoutList, Users, Building2, Plus, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { installers, type Project, type ProjectStatus } from '@/data/mockData';
import { useProjects } from '@/lib/appData';
import ProjectDetailPanel from './ProjectDetailPanel';
import ProjectsView from './gantt/ProjectsView';
import InstallersView from './gantt/InstallersView';
import ClientsView from './gantt/ClientsView';
import StatusFilter from './gantt/StatusFilter';
import CreateOrderDialog from './gantt/CreateOrderDialog';
import EditWorkOrderDialog from './gantt/EditWorkOrderDialog';
import { toast } from 'sonner';
import { installerConflicts } from '@/lib/schedulingConflicts';

interface DispatchChange {
  projectId: string;
  projectName: string;
  type: 'new' | 'changed' | 'cancelled';
  affectedInstallerIds: string[];
}

type ViewMode = 'day' | 'week' | 'month';
type GanttMode = 'projects' | 'installers' | 'clients';

const allStatuses: ProjectStatus[] = ['open', 'scheduled', 'in-progress', 'completed', 'on-hold', 'cancelled'];

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface GanttChartProps {
  onPendingChangesCount?: (count: number) => void;
}

const GanttChart = ({ onPendingChangesCount }: GanttChartProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [ganttMode, setGanttMode] = useState<GanttMode>('projects');
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useProjects();
  const [activeStatuses, setActiveStatuses] = useState<Set<ProjectStatus>>(new Set(allStatuses));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [pendingChanges, setPendingChanges] = useState<DispatchChange[]>([]);
  const lastDispatchedState = useRef<string>('');

  useEffect(() => {
    onPendingChangesCount?.(pendingChanges.length);
  }, [pendingChanges.length, onPendingChangesCount]);

  const trackChange = useCallback((projectId: string, projectName: string, type: 'new' | 'changed' | 'cancelled', affectedInstallerIds: string[]) => {
    setPendingChanges(prev => {
      const existing = prev.find(c => c.projectId === projectId);
      if (existing) {
        return prev.map(c => c.projectId === projectId ? { ...c, type, affectedInstallerIds } : c);
      }
      return [...prev, { projectId, projectName, type, affectedInstallerIds }];
    });
  }, []);

  const handleDispatch = useCallback(() => {
    if (pendingChanges.length === 0) return;

    pendingChanges.forEach(change => {
      const installerNames = change.affectedInstallerIds
        .map(id => installers.find(i => i.id === id)?.name)
        .filter(Boolean);

      if (installerNames.length > 0) {
        const label = change.type === 'new' ? 'NEW PROJECT' : change.type === 'cancelled' ? 'CANCELLED/ON-HOLD' : 'CHANGES to';
        installerNames.forEach(name => {
          toast.success(`📩 ${name}`, {
            description: `${label} ${change.projectName}`,
            duration: 5000,
          });
        });
      }
    });

    toast.info(`Dispatched ${pendingChanges.length} change${pendingChanges.length > 1 ? 's' : ''} to installers`);
    lastDispatchedState.current = JSON.stringify(projectsList);
    setPendingChanges([]);
  }, [pendingChanges, projectsList]);

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
        start.setDate(start.getDate() - today.getDay() + 1 + dateOffset * 14);
        break;
      case 'month': {
        const monthStart = new Date(today.getFullYear(), today.getMonth() + dateOffset, 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + dateOffset + 1, 0);
        numDays = monthEnd.getDate();
        start = monthStart;
        break;
      }
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

  const todayLabel = useMemo(() => {
    const now = new Date();
    switch (viewMode) {
      case 'day':
        return now.toLocaleDateString('en', { month: 'short', day: 'numeric' });
      case 'week':
        return `Week ${getISOWeekNumber(now)}`;
      case 'month':
        return now.toLocaleDateString('en', { month: 'long' });
    }
  }, [viewMode]);

  const getInstaller = (id: string | null) => id ? installers.find(i => i.id === id) ?? null : null;

  const handleDropProject = useCallback((projectId: string, installerId: string) => {
    const target = projectsList.find(p => p.id === projectId);
    const installer = installers.find(i => i.id === installerId);
    if (target && installer) {
      const blockers = installerConflicts(
        installer,
        {
          projectId: target.id,
          name: target.name,
          startDate: target.startDate,
          endDate: target.endDate,
          startTime: target.startTime,
          endTime: target.endTime,
          location: target.location,
          lat: target.locationLat,
          lng: target.locationLng,
        },
        projectsList,
      ).filter(c => c.severity === 'blocking');
      if (blockers.length > 0) {
        toast.error(blockers[0].title, { description: blockers[0].detail });
        return;
      }
    }
    setProjectsList(prev => {
      const updated = prev.map(p =>
        p.id === projectId
          ? {
              ...p,
              assigneeIds: p.assigneeIds.includes(installerId) ? p.assigneeIds : [...p.assigneeIds, installerId],
              status: p.status === 'open' ? 'scheduled' as ProjectStatus : p.status,
            }
          : p
      );
      const project = updated.find(p => p.id === projectId);
      if (project) {
        trackChange(projectId, project.name, 'changed', project.assigneeIds);
      }
      return updated;
    });
  }, [trackChange, projectsList, setProjectsList]);

  const handleUnassignProject = useCallback((projectId: string) => {
    setProjectsList(prev => {
      const project = prev.find(p => p.id === projectId);
      if (project && project.assigneeIds.length > 0) {
        trackChange(projectId, project.name, 'changed', []);
      }
      return prev.map(p =>
        p.id === projectId
          ? { ...p, assigneeIds: [], status: 'open' as ProjectStatus }
          : p
      );
    });
  }, [trackChange]);

  const handleUpdateProject = useCallback((projectId: string, updates: Partial<Project>) => {
    setProjectsList(prev => {
      const updated = prev.map(p =>
        p.id === projectId ? { ...p, ...updates } : p
      );
      const project = updated.find(p => p.id === projectId);
      if (project && project.assigneeIds.length > 0) {
        const newStatus = updates.status;
        const isCancelled = newStatus === 'cancelled' || newStatus === 'on-hold';
        trackChange(projectId, project.name, isCancelled ? 'cancelled' : 'changed', project.assigneeIds);
      }
      return updated;
    });
    setSelectedProject(prev => prev?.id === projectId ? { ...prev, ...updates } : prev);
  }, [trackChange]);

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

  const handleCreateOrder = useCallback((project: Project) => {
    setProjectsList(prev => [...prev, project]);
    if (project.assigneeIds.length > 0) {
      trackChange(project.id, project.name, 'new', project.assigneeIds);
    }
  }, [trackChange]);

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
              onClick={() => setGanttMode('clients')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                ganttMode === 'clients' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building2 className="w-3.5 h-3.5" />
              Clients
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
              {todayLabel}
            </button>
            <button onClick={() => setDateOffset(d => d + 1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create work order
            </button>

            <button
              onClick={handleDispatch}
              disabled={pendingChanges.length === 0}
              className={cn(
                "flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                pendingChanges.length > 0
                  ? "bg-green-600 text-white hover:bg-green-700 shadow-sm ring-1 ring-green-500"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch
              {pendingChanges.length > 0 && (
                <div className="flex items-center gap-1.5 ml-1">
                  {pendingChanges.filter(c => c.type === 'new').length > 0 && (
                    <span className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                      {pendingChanges.filter(c => c.type === 'new').length} new
                    </span>
                  )}
                  {pendingChanges.filter(c => c.type === 'cancelled').length > 0 && (
                    <span className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                      {pendingChanges.filter(c => c.type === 'cancelled').length} cancelled
                    </span>
                  )}
                  {pendingChanges.filter(c => c.type === 'changed').length > 0 && (
                    <span className="bg-white/20 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                      {pendingChanges.filter(c => c.type === 'changed').length} changed
                    </span>
                  )}
                </div>
              )}
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
          onUpdateProject={handleUpdateProject}
          activeStatuses={activeStatuses}
          viewMode={viewMode}
        />
      ) : ganttMode === 'clients' ? (
        <ClientsView
          projects={projectsList}
          days={days}
          colWidth={colWidth}
          startDate={startDate}
          todayStr={todayStr}
          onSelectProject={setSelectedProject}
          onUpdateProject={handleUpdateProject}
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
          onUnassignProject={handleUnassignProject}
          onUpdateProject={handleUpdateProject}
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
          onEdit={(p) => { setEditProject(p); setEditDialogOpen(true); }}
        />
      )}
      <EditWorkOrderDialog
        project={editProject}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleUpdateProject}
      />
      <CreateOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateOrder={handleCreateOrder}
      />
    </div>
  );
};

export default GanttChart;
