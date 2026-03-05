import { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { type Project, type Installer, type ProjectStatus } from '@/data/mockData';
import GanttHeader from './GanttHeader';
import GanttGrid from './GanttGrid';
import OrderBox from './OrderBox';
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

const installerColorMap: Record<number, string> = {
  1: 'bg-installer-1',
  2: 'bg-installer-2',
  3: 'bg-installer-3',
  4: 'bg-installer-4',
  5: 'bg-installer-5',
  6: 'bg-installer-6',
};

interface InstallersViewProps {
  projects: Project[];
  installers: Installer[];
  days: Date[];
  colWidth: number;
  startDate: Date;
  todayStr: string;
  onSelectProject: (project: Project) => void;
  onDropProject: (projectId: string, installerId: string) => void;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  activeStatuses: Set<ProjectStatus>;
  viewMode?: 'day' | 'week' | 'month';
}

const rowHeight = 72;
const headerHeight = 60;
const labelWidth = 280;

const InstallersView = ({
  projects, installers: allInstallers, days, colWidth, startDate, todayStr,
  onSelectProject, onDropProject, onUpdateProject, activeStatuses, viewMode,
}: InstallersViewProps) => {
  const [pendingChange, setPendingChange] = useState<{
    projectId: string; newStart: string; newEnd: string; installerId?: string;
  } | null>(null);

  const groups = useMemo(() => {
    const map: { installer: Installer | null; projects: Project[] }[] = [];

    allInstallers.forEach(inst => {
      map.push({
        installer: inst,
        projects: projects.filter(p => p.assigneeIds.includes(inst.id) && activeStatuses.has(p.status)),
      });
    });

    const unassigned = projects.filter(p => p.assigneeIds.length === 0 && activeStatuses.has(p.status));
    if (unassigned.length > 0) {
      map.push({ installer: null, projects: unassigned });
    }

    return map;
  }, [projects, allInstallers, activeStatuses]);

  const totalGridWidth = days.length * colWidth;

  const getBarDates = (project: Project, installerId?: string) => {
    if (installerId && project.installerDateOverrides?.[installerId]) {
      return project.installerDateOverrides[installerId];
    }
    return { startDate: project.startDate, endDate: project.endDate };
  };

  const getBarPosition = (project: Project, installerId?: string) => {
    const dates = getBarDates(project, installerId);
    const pStart = new Date(dates.startDate);
    const pEnd = new Date(dates.endDate);
    const startDiff = Math.floor((pStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.floor((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const rawLeft = startDiff * colWidth;
    const rawRight = rawLeft + duration * colWidth - 4;
    const clippedLeft = Math.max(rawLeft, 0);
    const clippedRight = Math.min(rawRight, totalGridWidth);
    const overflowRight = rawRight > totalGridWidth;
    return { left: clippedLeft, width: Math.max(clippedRight - clippedLeft, 20), overflowRight };
  };

  const getAbsencePosition = (absStart: string, absEnd: string) => {
    const aStart = new Date(absStart);
    const aEnd = new Date(absEnd);
    const startDiff = Math.floor((aStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.floor((aEnd.getTime() - aStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { left: startDiff * colWidth, width: duration * colWidth };
  };

  const getOccupancy = (inst: Installer, instProjects: Project[]) => {
    let busySlots = 0;
    const totalDays = days.length;
    days.forEach(day => {
      const dayStr = day.toISOString().split('T')[0];
      const projCount = instProjects.filter(p => dayStr >= p.startDate && dayStr <= p.endDate).length;
      const hasAbsenceOnDay = inst.absences.some(a => dayStr >= a.startDate && dayStr <= a.endDate);
      busySlots += projCount + (hasAbsenceOnDay ? 1 : 0);
    });
    return Math.round((busySlots / totalDays) * 100);
  };

  const totalHeight = groups.length * rowHeight;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, installerId: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    if (projectId) {
      onDropProject(projectId, installerId);
    }
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('projectId', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleBarDragEnd = useCallback((projectId: string, newStart: string, newEnd: string, installerId?: string) => {
    setPendingChange({ projectId, newStart, newEnd, installerId });
  }, []);

  const pendingProject = pendingChange ? projects.find(p => p.id === pendingChange.projectId) : null;
  const isMultiInstaller = (pendingProject?.assigneeIds.length ?? 0) > 1;

  const handleConfirmAll = useCallback(() => {
    if (!pendingChange) return;
    onUpdateProject(pendingChange.projectId, {
      startDate: pendingChange.newStart,
      endDate: pendingChange.newEnd,
    });
    setPendingChange(null);
  }, [pendingChange, onUpdateProject]);

  const handleConfirmOne = useCallback(() => {
    if (!pendingChange || !pendingChange.installerId) {
      handleConfirmAll();
      return;
    }
    const project = projects.find(p => p.id === pendingChange.projectId);
    if (!project) return;
    onUpdateProject(pendingChange.projectId, {
      installerDateOverrides: {
        ...project.installerDateOverrides,
        [pendingChange.installerId]: {
          startDate: pendingChange.newStart,
          endDate: pendingChange.newEnd,
        },
      },
    });
    setPendingChange(null);
  }, [pendingChange, projects, onUpdateProject, handleConfirmAll]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Labels */}
        <div className="shrink-0 border-r border-border bg-card" style={{ width: labelWidth }}>
          <div className="sticky top-0 z-10">
            <div className="border-b border-border bg-gantt-header" style={{ height: 24 }} />
            <div className="border-b border-border flex items-center px-4 bg-gantt-header" style={{ height: headerHeight - 24 }}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Installer</span>
              <span className="ml-auto text-xs font-semibold text-muted-foreground uppercase tracking-wider">Occupancy</span>
            </div>
          </div>
          {groups.map((group, idx) => {
            const inst = group.installer;
            const allInstProjects = projects.filter(p => inst && p.assigneeIds.includes(inst.id));
            const occupancy = inst ? getOccupancy(inst, allInstProjects) : 0;
            return (
              <div
                key={inst?.id ?? 'unassigned'}
                className={cn(
                  "flex items-center gap-3 px-4 border-b border-border",
                  idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                )}
                style={{ height: rowHeight }}
                onDragOver={inst ? handleDragOver : undefined}
                onDrop={inst ? (e) => handleDrop(e, inst.id) : undefined}
              >
                {inst ? (
                  <>
                    <div className={cn("w-3 h-3 rounded-full shrink-0", installerColorMap[inst.color])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{inst.name}</p>
                      <p className="text-xs text-muted-foreground">{inst.type === 'sub-vendor' ? 'Sub-vendor' : 'Internal'} · {group.projects.length} projects</p>
                    </div>
                    <div className="shrink-0 w-14 text-right">
                      <span className={cn(
                        "text-sm font-bold",
                        occupancy > 80 ? "text-status-cancelled" : occupancy > 50 ? "text-status-on-hold" : "text-status-completed"
                      )}>{occupancy}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full shrink-0 bg-muted-foreground/30 border border-dashed border-muted-foreground/50" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-muted-foreground truncate">Unassigned</p>
                      <p className="text-xs text-muted-foreground">{group.projects.length} projects</p>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto gantt-scroll">
          <div style={{ minWidth: days.length * colWidth }}>
            <GanttHeader days={days} colWidth={colWidth} headerHeight={headerHeight} todayStr={todayStr} viewMode={viewMode} />
            <div className="relative overflow-hidden">
              <GanttGrid days={days} colWidth={colWidth} totalHeight={totalHeight} todayStr={todayStr} />
              {groups.map((group, gIdx) => {
                const inst = group.installer;
                return (
                  <div
                    key={inst?.id ?? 'unassigned'}
                    className={cn("border-b border-gantt-grid relative", gIdx % 2 === 0 ? "" : "bg-muted/10")}
                    style={{ height: rowHeight }}
                    onDragOver={inst ? handleDragOver : undefined}
                    onDrop={inst ? (e) => handleDrop(e, inst.id) : undefined}
                  >
                    {/* Absence bars */}
                    {inst?.absences.map(absence => {
                      const { left, width } = getAbsencePosition(absence.startDate, absence.endDate);
                      return (
                        <div
                          key={absence.id}
                          className="absolute top-1 h-[calc(100%-8px)] rounded bg-destructive/10 border border-dashed border-destructive/30 flex items-center justify-center z-10"
                          style={{ left: Math.max(left, 0), width: Math.max(width, 20) }}
                        >
                          <span className="text-[10px] text-destructive/70 font-medium truncate px-2">
                            {absence.type === 'vacation' ? '🏖️' : absence.type === 'sick' ? '🤒' : '📅'} {absence.label || absence.type}
                          </span>
                        </div>
                      );
                    })}

                    {/* Project bars */}
                    {group.projects.map((project, pIdx) => {
                      const dates = getBarDates(project, inst?.id);
                      const { left, width, overflowRight } = getBarPosition(project, inst?.id);
                      const yOffset = group.projects.length > 1 ? (pIdx % 2 === 0 ? 6 : 34) : 18;
                      const barHeight = group.projects.length > 1 ? 28 : 34;
                      return (
                        <DraggableBar
                          key={project.id}
                          left={left}
                          width={width}
                          top={yOffset}
                          height={barHeight}
                          colWidth={colWidth}
                          projectStartDate={dates.startDate}
                          projectEndDate={dates.endDate}
                          className={cn(
                            "rounded-md border-l-[3px] flex items-center px-2 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md z-20",
                            statusBorderMap[project.status],
                            statusColorMap[project.status]
                          )}
                          onClick={() => onSelectProject(project)}
                          onDragEnd={(newStart, newEnd) => handleBarDragEnd(project.id, newStart, newEnd, inst?.id)}
                        >
                          <span className="text-[11px] font-medium text-foreground truncate flex-1" style={{ lineHeight: `${barHeight}px` }}>{project.name}</span>
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

      {/* OrderBox - only shows for installers view with internal installers */}
      <OrderBox projects={projects} onSelectProject={onSelectProject} />

      <DateChangeDialog
        open={!!pendingChange}
        isMultiInstaller={isMultiInstaller}
        onConfirmAll={handleConfirmAll}
        onConfirmOne={handleConfirmOne}
        onCancel={() => setPendingChange(null)}
      />
    </div>
  );
};

export default InstallersView;
