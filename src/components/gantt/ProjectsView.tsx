import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { type Project, type Installer, type ProjectStatus, installers } from '@/data/mockData';
import { ArrowUpDown, Filter } from 'lucide-react';
import GanttHeader from './GanttHeader';
import GanttGrid from './GanttGrid';
import DraggableBar from './DraggableBar';
import DateChangeDialog from './DateChangeDialog';

const statusColorMap: Record<ProjectStatus, string> = {
  'open': 'bg-status-open',
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
};

const statusBorderMap: Record<ProjectStatus, string> = {
  'open': 'border-status-open',
  'scheduled': 'border-status-scheduled',
  'in-progress': 'border-status-in-progress',
  'completed': 'border-status-completed',
  'on-hold': 'border-status-on-hold',
  'cancelled': 'border-status-cancelled',
};

const installerBgMap: Record<number, string> = {
  1: 'bg-installer-1/15',
  2: 'bg-installer-2/15',
  3: 'bg-installer-3/15',
  4: 'bg-installer-4/15',
  5: 'bg-installer-5/15',
  6: 'bg-installer-6/15',
};

type SortField = 'name' | 'status' | 'startDate' | 'installer';

interface ProjectsViewProps {
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

const rowHeight = 52;
const headerHeight = 60;
const labelWidth = 260;

const ProjectsView = ({ projects, days, colWidth, startDate, todayStr, onSelectProject, onUpdateProject, activeStatuses, viewMode }: ProjectsViewProps) => {
  const [sortField, setSortField] = useState<SortField>('startDate');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterInstaller, setFilterInstaller] = useState<string>('all');
  const [pendingChange, setPendingChange] = useState<{ projectId: string; newStart: string; newEnd: string } | null>(null);

  const getInstaller = (id: string) => installers.find(i => i.id === id) ?? null;
  const getFirstInstaller = (p: Project) => p.assigneeIds.length > 0 ? getInstaller(p.assigneeIds[0]) : null;

  const filteredAndSorted = useMemo(() => {
    let result = projects.filter(p => activeStatuses.has(p.status));

    if (filterInstaller !== 'all') {
      if (filterInstaller === 'unassigned') {
        result = result.filter(p => p.assigneeIds.length === 0);
      } else {
        result = result.filter(p => p.assigneeIds.includes(filterInstaller));
      }
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'startDate': cmp = a.startDate.localeCompare(b.startDate); break;
        case 'installer': {
          const aI = getFirstInstaller(a)?.name ?? 'zzz';
          const bI = getFirstInstaller(b)?.name ?? 'zzz';
          cmp = aI.localeCompare(bI);
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [projects, activeStatuses, filterInstaller, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sort/Filter bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border bg-muted/30">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        <select
          value={filterInstaller}
          onChange={(e) => setFilterInstaller(e.target.value)}
          className="text-xs bg-card border border-border rounded px-2 py-1 text-foreground"
        >
          <option value="all">All installers</option>
          <option value="unassigned">Unassigned</option>
          {installers.map(inst => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
        </select>
        <div className="w-px h-4 bg-border" />
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
        {(['name', 'status', 'startDate', 'installer'] as SortField[]).map(field => (
          <button
            key={field}
            onClick={() => toggleSort(field)}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors capitalize",
              sortField === field ? "text-foreground font-semibold bg-secondary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {field === 'startDate' ? 'Date' : field}
            {sortField === field && (sortAsc ? ' ↑' : ' ↓')}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Labels */}
        <div className="shrink-0 border-r border-border bg-card" style={{ width: labelWidth }}>
          <div className="sticky top-0 z-10">
            <div className="border-b border-border bg-gantt-header" style={{ height: 24 }} />
            <div className="border-b border-border flex items-center px-4 bg-gantt-header" style={{ height: headerHeight - 24 }}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project</span>
            </div>
          </div>
          {filteredAndSorted.map((project, idx) => {
            const assignees = project.assigneeIds.map(id => getInstaller(id)).filter(Boolean) as Installer[];
            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className={cn(
                  "flex items-center gap-3 px-4 border-b border-border cursor-pointer transition-colors hover:bg-secondary/50",
                  idx % 2 === 0 ? "bg-card" : "bg-muted/20"
                )}
                style={{ height: rowHeight }}
              >
                <div className={cn("w-1 h-8 rounded-full", statusColorMap[project.status])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {assignees.length > 0 ? assignees.map(a => a.name).join(', ') : '— Unassigned —'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto gantt-scroll">
          <div style={{ minWidth: days.length * colWidth }}>
            <GanttHeader days={days} colWidth={colWidth} headerHeight={headerHeight} todayStr={todayStr} viewMode={viewMode} />
            <div className="relative overflow-hidden">
              <GanttGrid days={days} colWidth={colWidth} totalHeight={filteredAndSorted.length * rowHeight} todayStr={todayStr} />
              {filteredAndSorted.map((project, idx) => {
                const { left, width, overflowRight } = getBarPosition(project);
                const assignees = project.assigneeIds.map(id => getInstaller(id)).filter(Boolean) as Installer[];
                const instColor = assignees.length > 0 && assignees[0] ? installerBgMap[assignees[0].color] : 'bg-muted/40';
                return (
                  <div
                    key={project.id}
                    className={cn("border-b border-gantt-grid", idx % 2 === 0 ? "" : "bg-muted/10")}
                    style={{ height: rowHeight }}
                  >
                    <DraggableBar
                      left={left}
                      width={width}
                      top={8}
                      height={36}
                      colWidth={colWidth}
                      projectStartDate={project.startDate}
                      projectEndDate={project.endDate}
                      className={cn(
                        "rounded-md border-l-[3px] flex items-center px-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md",
                        statusBorderMap[project.status],
                        instColor
                      )}
                      onClick={() => onSelectProject(project)}
                      onDragEnd={(newStart, newEnd) => handleBarDragEnd(project.id, newStart, newEnd)}
                    >
                      <span className="text-xs font-medium text-foreground truncate flex-1">{project.name}</span>
                      {assignees.length > 1 && (
                        <span className="ml-1 text-[10px] text-muted-foreground shrink-0">+{assignees.length - 1}</span>
                      )}
                      {overflowRight && (
                        <span className="ml-1 text-xs font-bold text-foreground shrink-0">&raquo;</span>
                      )}
                    </DraggableBar>
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

export default ProjectsView;
