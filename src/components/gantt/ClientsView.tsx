import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { type Project, type Installer, type ProjectStatus, installers } from '@/data/mockData';
import GanttHeader from './GanttHeader';
import GanttGrid from './GanttGrid';
import DraggableBar from './DraggableBar';
import DateChangeDialog from './DateChangeDialog';

const statusBorderMap: Record<ProjectStatus, string> = {
  'open': 'border-status-open',
  'scheduled': 'border-status-scheduled',
  'in-progress': 'border-status-in-progress',
  'completed': 'border-status-completed',
  'on-hold': 'border-status-on-hold',
  'cancelled': 'border-status-cancelled',
};

const statusColorMap: Record<ProjectStatus, string> = {
  'open': 'bg-status-open/20',
  'scheduled': 'bg-status-scheduled/20',
  'in-progress': 'bg-status-in-progress/20',
  'completed': 'bg-status-completed/20',
  'on-hold': 'bg-status-on-hold/20',
  'cancelled': 'bg-status-cancelled/20',
};

interface ClientsViewProps {
  projects: Project[];
  days: Date[];
  colWidth: number;
  startDate: Date;
  todayStr: string;
  onSelectProject: (project: Project) => void;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  activeStatuses: Set<ProjectStatus>;
  viewMode?: 'day' | 'week' | 'month';
}

const baseRowHeight = 52;
const barHeight = 28;
const barGap = 4;
const headerHeight = 60;
const labelWidth = 260;

const activeStatuses: ProjectStatus[] = ['open', 'scheduled', 'in-progress', 'on-hold'];

interface ClientGroup {
  client: string;
  projects: Project[];
  activeCount: number;
  closestDeadline: string | null;
  hasActiveInView: boolean;
}

const ClientsView = ({ projects, days, colWidth, startDate, todayStr, onSelectProject, onUpdateProject, activeStatuses: filterStatuses, viewMode }: ClientsViewProps) => {
  const [pendingChange, setPendingChange] = useState<{ projectId: string; newStart: string; newEnd: string } | null>(null);

  const getInstaller = (id: string) => installers.find(i => i.id === id) ?? null;

  const today = new Date();
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
  const thirtyDaysStr = thirtyDaysOut.toISOString().split('T')[0];
  const todayIso = today.toISOString().split('T')[0];

  const clientGroups = useMemo(() => {
    // Group projects by client
    const map = new Map<string, Project[]>();
    projects.forEach(p => {
      if (!filterStatuses.has(p.status)) return;
      const list = map.get(p.client) || [];
      list.push(p);
      map.set(p.client, list);
    });

    const groups: ClientGroup[] = Array.from(map.entries()).map(([client, clientProjects]) => {
      const activeProjects = clientProjects.filter(p =>
        activeStatuses.includes(p.status)
      );
      const closestDeadline = activeProjects.length > 0
        ? activeProjects.reduce((min, p) => p.endDate < min ? p.endDate : min, activeProjects[0].endDate)
        : null;

      return {
        client,
        projects: clientProjects,
        activeCount: activeProjects.length,
        closestDeadline,
        hasActiveInView: activeProjects.length > 0 && closestDeadline !== null && closestDeadline <= thirtyDaysStr,
      };
    });

    // Sort: active with closest deadline first, then by deadline ascending, inactive at bottom
    groups.sort((a, b) => {
      // Both have active projects
      if (a.activeCount > 0 && b.activeCount > 0) {
        // Both within 30 days - sort by closest deadline
        return (a.closestDeadline ?? '9999').localeCompare(b.closestDeadline ?? '9999');
      }
      // Active before inactive
      if (a.activeCount > 0 && b.activeCount === 0) return -1;
      if (a.activeCount === 0 && b.activeCount > 0) return 1;
      // Both inactive
      return a.client.localeCompare(b.client);
    });

    return groups;
  }, [projects, filterStatuses]);

  const getRowHeight = (group: ClientGroup) => {
    const count = group.projects.length;
    if (count <= 1) return baseRowHeight;
    return Math.max(baseRowHeight, count * (barHeight + barGap) + barGap * 2);
  };

  const totalGridWidth = days.length * colWidth;

  const getBarPosition = (project: Project) => {
    const pStart = new Date(project.startDate);
    const pEnd = new Date(project.endDate);
    const startDiff = Math.floor((pStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.floor((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const rawLeft = startDiff * colWidth;
    const rawRight = rawLeft + duration * colWidth - 4;
    const clippedLeft = Math.max(rawLeft, 0);
    const clippedRight = Math.min(rawRight, totalGridWidth);
    const overflowRight = rawRight > totalGridWidth;
    return { left: clippedLeft, width: Math.max(clippedRight - clippedLeft, 20), overflowRight };
  };

  const handleBarDragEnd = useCallback((projectId: string, newStart: string, newEnd: string) => {
    setPendingChange({ projectId, newStart, newEnd });
  }, []);

  const handleConfirmAll = useCallback(() => {
    if (!pendingChange) return;
    onUpdateProject(pendingChange.projectId, {
      startDate: pendingChange.newStart,
      endDate: pendingChange.newEnd,
    });
    setPendingChange(null);
  }, [pendingChange, onUpdateProject]);

  const isMultiInstaller = pendingChange
    ? (projects.find(p => p.id === pendingChange.projectId)?.assigneeIds.length ?? 0) > 1
    : false;

  const totalHeight = clientGroups.reduce((sum, g) => sum + getRowHeight(g), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Labels */}
        <div className="shrink-0 border-r border-border bg-card" style={{ width: labelWidth }}>
          <div className="sticky top-0 z-10">
            <div className="border-b border-border bg-gantt-header" style={{ height: 24 }} />
            <div className="border-b border-border flex items-center px-4 bg-gantt-header" style={{ height: headerHeight - 24 }}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</span>
              <span className="ml-auto text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active</span>
            </div>
          </div>
          {clientGroups.map((group, idx) => (
            <div
              key={group.client}
              className={cn(
                "flex items-center gap-3 px-4 border-b border-border",
                idx % 2 === 0 ? "bg-card" : "bg-muted/20"
              )}
              style={{ height: getRowHeight(group) }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{group.client}</p>
                <p className="text-xs text-muted-foreground">
                  {group.projects.length} project{group.projects.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="shrink-0">
                <span className={cn(
                  "text-sm font-bold tabular-nums",
                  group.activeCount > 0 ? "text-primary" : "text-muted-foreground"
                )}>
                  {group.activeCount}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto gantt-scroll">
          <div style={{ minWidth: days.length * colWidth }}>
            <GanttHeader days={days} colWidth={colWidth} headerHeight={headerHeight} todayStr={todayStr} viewMode={viewMode} />
            <div className="relative overflow-hidden">
              <GanttGrid days={days} colWidth={colWidth} totalHeight={totalHeight} todayStr={todayStr} />
              {clientGroups.map((group, gIdx) => {
                const rowH = getRowHeight(group);
                return (
                  <div
                    key={group.client}
                    className={cn("border-b border-gantt-grid relative", gIdx % 2 === 0 ? "" : "bg-muted/10")}
                    style={{ height: rowH }}
                  >
                    {group.projects.map((project, pIdx) => {
                      const { left, width, overflowRight } = getBarPosition(project);
                      const yOffset = group.projects.length > 1
                        ? barGap * 2 + pIdx * (barHeight + barGap)
                        : (rowH - barHeight) / 2;
                      const assignees = project.assigneeIds.map(id => getInstaller(id)).filter(Boolean) as Installer[];
                      return (
                        <DraggableBar
                          key={project.id}
                          left={left}
                          width={width}
                          top={yOffset}
                          height={barHeight}
                          colWidth={colWidth}
                          projectStartDate={project.startDate}
                          projectEndDate={project.endDate}
                          className={cn(
                            "rounded-md border-l-[3px] flex items-center px-2 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md z-20",
                            statusBorderMap[project.status],
                            statusColorMap[project.status],
                            project.status === 'cancelled' && "opacity-60"
                          )}
                          onClick={() => onSelectProject(project)}
                          onDragEnd={(newStart, newEnd) => handleBarDragEnd(project.id, newStart, newEnd)}
                        >
                          <span className={cn("text-[11px] font-medium truncate flex-1", project.status === 'cancelled' ? "text-muted-foreground" : "text-foreground")} style={{ lineHeight: `${barHeight}px` }}>
                            {project.name}
                          </span>
                          {assignees.length > 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground shrink-0">👥{assignees.length}</span>
                          )}
                          {assignees.length === 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground shrink-0">🔧1</span>
                          )}
                          {overflowRight && (
                            <span className="ml-1 text-xs font-bold text-foreground shrink-0">&raquo;</span>
                          )}
                        </DraggableBar>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <DateChangeDialog
        open={!!pendingChange}
        isMultiInstaller={isMultiInstaller}
        onConfirmAll={handleConfirmAll}
        onConfirmOne={handleConfirmAll}
        onCancel={() => setPendingChange(null)}
      />
    </div>
  );
};

export default ClientsView;
