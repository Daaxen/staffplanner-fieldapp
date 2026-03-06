import { useMemo, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { type Project, type Installer, type ProjectStatus, projectTypeIcons } from '@/data/mockData';
import GanttHeader from './GanttHeader';
import GanttGrid from './GanttGrid';
import OrderBox from './OrderBox';
import DraggableBar from './DraggableBar';
import DateChangeDialog from './DateChangeDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  onUnassignProject: (projectId: string) => void;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  activeStatuses: Set<ProjectStatus>;
  viewMode?: 'day' | 'week' | 'month';
}

const baseRowHeight = 72;
const barH = 28;
const barGap = 4;
const barPadding = 6;
const headerHeight = 60;
const labelWidth = 280;

const InstallersView = ({
  projects, installers: allInstallers, days, colWidth, startDate, todayStr,
  onSelectProject, onDropProject, onUnassignProject, onUpdateProject, activeStatuses, viewMode,
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

  // Stack projects so they don't overlap
  const getProjectLanes = useCallback((groupProjects: Project[], installerId?: string) => {
    const lanes: { endDay: number }[] = [];
    const assignments: number[] = [];
    
    // Sort by start date
    const sorted = [...groupProjects].sort((a, b) => {
      const aDates = getBarDates(a, installerId);
      const bDates = getBarDates(b, installerId);
      return aDates.startDate.localeCompare(bDates.startDate);
    });

    sorted.forEach((project) => {
      const dates = getBarDates(project, installerId);
      const pStart = new Date(dates.startDate);
      const startDay = Math.floor((pStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      let lane = lanes.findIndex(l => l.endDay <= startDay);
      if (lane === -1) {
        lane = lanes.length;
        lanes.push({ endDay: 0 });
      }
      
      const pEnd = new Date(dates.endDate);
      const endDay = Math.floor((pEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      lanes[lane].endDay = endDay;
      assignments.push(lane);
    });

    const map = new Map<string, number>();
    sorted.forEach((p, i) => map.set(p.id, assignments[i]));
    return { laneCount: lanes.length, laneMap: map };
  }, [startDate]);

  const groupLayouts = useMemo(() => {
    return groups.map(g => getProjectLanes(g.projects, g.installer?.id));
  }, [groups, getProjectLanes]);

  const getRowHeight = (laneCount: number) => {
    if (laneCount <= 1) return baseRowHeight;
    return Math.max(baseRowHeight, laneCount * (barH + barGap) + barPadding * 2);
  };

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

  const totalHeight = groups.reduce((sum, _, i) => sum + getRowHeight(groupLayouts[i]?.laneCount ?? 1), 0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const [vacationWarning, setVacationWarning] = useState<{ installerName: string; absenceLabel: string } | null>(null);

  const checkVacationConflict = useCallback((installer: Installer, projStart: string, projEnd: string): string | null => {
    const conflict = installer.absences.find(a => a.startDate <= projEnd && a.endDate >= projStart);
    return conflict ? (conflict.label || conflict.type) : null;
  }, []);

  const handleDrop = (e: React.DragEvent, installerId: string) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    if (!projectId) return;
    const project = projects.find(p => p.id === projectId);
    const installer = allInstallers.find(i => i.id === installerId);
    if (project && installer) {
      const conflict = checkVacationConflict(installer, project.startDate, project.endDate);
      if (conflict) {
        setVacationWarning({ installerName: installer.name, absenceLabel: conflict });
        return;
      }
    }
    onDropProject(projectId, installerId);
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('projectId', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const timelineRef = useRef<HTMLDivElement>(null);

  const handleBarDragEnd = useCallback((projectId: string, newStart: string, newEnd: string, installerId?: string, dropClientY?: number) => {
    // Helper to check vacation for a target installer
    const checkAndWarn = (inst: Installer): boolean => {
      const conflict = checkVacationConflict(inst, newStart, newEnd);
      if (conflict) {
        setVacationWarning({ installerName: inst.name, absenceLabel: conflict });
        return true;
      }
      return false;
    };

    // Check if dropped on a different installer row
    if (dropClientY != null && timelineRef.current) {
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const relativeY = dropClientY - timelineRect.top;
      const targetRowIdx = Math.floor(relativeY / rowHeight);
      
      if (targetRowIdx >= 0 && targetRowIdx < groups.length) {
        const targetGroup = groups[targetRowIdx];
        const targetInstaller = targetGroup.installer;
        const sourceInstaller = installerId;
        
        if (targetInstaller && targetInstaller.id !== sourceInstaller) {
          if (checkAndWarn(targetInstaller)) return;
          const project = projects.find(p => p.id === projectId);
          if (project) {
            const newAssigneeIds = project.assigneeIds.filter(id => id !== sourceInstaller);
            if (!newAssigneeIds.includes(targetInstaller.id)) {
              newAssigneeIds.push(targetInstaller.id);
            }
            onUpdateProject(projectId, {
              startDate: newStart,
              endDate: newEnd,
              assigneeIds: newAssigneeIds,
              status: project.status === 'open' ? 'scheduled' as ProjectStatus : project.status,
            });
            return;
          }
        } else if (!targetInstaller && sourceInstaller) {
          onUnassignProject(projectId);
          return;
        } else if (targetInstaller && !sourceInstaller) {
          if (checkAndWarn(targetInstaller)) return;
          onDropProject(projectId, targetInstaller.id);
          onUpdateProject(projectId, { startDate: newStart, endDate: newEnd });
          return;
        }
      }
    }

    // Same-row drag: check current installer
    if (installerId) {
      const inst = allInstallers.find(i => i.id === installerId);
      if (inst && checkAndWarn(inst)) return;
    }
    
    setPendingChange({ projectId, newStart, newEnd, installerId });
  }, [groups, projects, allInstallers, onUpdateProject, onDropProject, onUnassignProject, checkVacationConflict]);

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
      <div className="flex-1 overflow-auto gantt-scroll relative">
        <div className="relative" style={{ minWidth: days.length * colWidth + labelWidth }}>
          {/* Header row */}
          <div className="sticky top-0 z-30 flex">
            <div className="sticky left-0 z-40 shrink-0 border-r border-border bg-gantt-header" style={{ width: labelWidth }}>
              <div className="border-b border-border bg-gantt-header" style={{ height: 24 }} />
              <div className="border-b border-border flex items-center px-4 bg-gantt-header" style={{ height: headerHeight - 24 }}>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Installer</span>
                <span className="ml-auto text-xs font-semibold text-muted-foreground uppercase tracking-wider">Occupancy</span>
              </div>
            </div>
            <div className="flex-1">
              <GanttHeader days={days} colWidth={colWidth} headerHeight={headerHeight} todayStr={todayStr} viewMode={viewMode} />
            </div>
          </div>

          {/* Body rows */}
          <div className="flex">
            {/* Labels */}
            <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-card" style={{ width: labelWidth }}>
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
            <div className="flex-1 relative" ref={timelineRef}>
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
                          allowVerticalDrag
                          className={cn(
                            "rounded-md border-l-[3px] flex items-center px-2 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md z-10",
                            statusBorderMap[project.status],
                            statusColorMap[project.status],
                            project.status === 'cancelled' && "opacity-60"
                          )}
                          onClick={() => onSelectProject(project)}
                          onDragEnd={(newStart, newEnd, dropClientY) => handleBarDragEnd(project.id, newStart, newEnd, inst?.id, dropClientY)}
                        >
                          <span className={cn("text-[11px] font-medium truncate flex-1", project.status === 'cancelled' ? "text-muted-foreground" : "text-foreground")} style={{ lineHeight: `${barHeight}px` }}>{projectTypeIcons[project.projectType]} {project.isFlexOrder && <span title="Flex Order">↔ </span>}{project.name}</span>
                          {project.assigneeIds.length > 1 && (
                            <span className="ml-1 text-[10px] text-muted-foreground shrink-0">👥{project.assigneeIds.length}</span>
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

      {/* OrderBox - only shows for installers view with internal installers */}
      <OrderBox projects={projects} onSelectProject={onSelectProject} onUnassignProject={onUnassignProject} />

      <DateChangeDialog
        open={!!pendingChange}
        isMultiInstaller={isMultiInstaller}
        onConfirmAll={handleConfirmAll}
        onConfirmOne={handleConfirmOne}
        onCancel={() => setPendingChange(null)}
      />

      <AlertDialog open={!!vacationWarning} onOpenChange={() => setVacationWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Vacation Conflict</AlertDialogTitle>
            <AlertDialogDescription>
              Cannot place this project on <span className="font-semibold">{vacationWarning?.installerName}</span> — they have a planned absence (<span className="font-semibold">{vacationWarning?.absenceLabel}</span>) during this period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setVacationWarning(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InstallersView;
