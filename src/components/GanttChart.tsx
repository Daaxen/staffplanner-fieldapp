import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { projects, installers, statusLabels, type Project, type ProjectStatus } from '@/data/mockData';
import { motion } from 'framer-motion';
import ProjectDetailPanel from './ProjectDetailPanel';

type ViewMode = 'day' | 'week' | 'month';

const statusColorMap: Record<ProjectStatus, string> = {
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
};

const statusBorderMap: Record<ProjectStatus, string> = {
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

const GanttChart = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

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
  const rowHeight = 52;
  const headerHeight = 60;
  const labelWidth = 260;

  const getBarPosition = (project: Project) => {
    const pStart = new Date(project.startDate);
    const pEnd = new Date(project.endDate);
    const startDiff = Math.floor((pStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.floor((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return {
      left: startDiff * colWidth,
      width: duration * colWidth - 4,
    };
  };

  const getInstaller = (id: string) => installers.find(i => i.id === id);

  const formatDay = (d: Date) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      dayName: dayNames[d.getDay()],
      dayNum: d.getDate(),
      monthName: d.toLocaleDateString('en', { month: 'short' }),
      isToday: d.toISOString().split('T')[0] === todayStr,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  };

  const viewLabel = useMemo(() => {
    if (days.length === 0) return '';
    const first = days[0];
    const last = days[days.length - 1];
    return `${first.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [days]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Installation Planner</h2>
          <p className="text-sm text-muted-foreground">{viewLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex bg-secondary rounded-lg p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); setDateOffset(0); }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize",
                  viewMode === mode
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
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

      {/* Status legend */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-border bg-card">
        {(Object.entries(statusLabels) as [ProjectStatus, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-sm", statusColorMap[key])} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Gantt body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Project labels */}
        <div className="shrink-0 border-r border-border bg-card" style={{ width: labelWidth }}>
          <div className="h-[60px] border-b border-border flex items-center px-4">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project</span>
          </div>
          {projects.map((project, idx) => {
            const inst = getInstaller(project.assigneeId);
            return (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className={cn(
                  "flex items-center gap-3 px-4 border-b border-border cursor-pointer transition-colors hover:bg-secondary/50",
                  idx % 2 === 0 ? "bg-card" : "bg-muted/30"
                )}
                style={{ height: rowHeight }}
              >
                <div className={cn("w-1 h-8 rounded-full", statusColorMap[project.status])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{inst?.name ?? 'Unassigned'}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-x-auto gantt-scroll">
          <div style={{ minWidth: days.length * colWidth }}>
            {/* Day headers */}
            <div className="flex border-b border-border bg-gantt-header sticky top-0 z-10" style={{ height: headerHeight }}>
              {days.map((day, i) => {
                const { dayName, dayNum, monthName, isToday, isWeekend } = formatDay(day);
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col items-center justify-center border-r border-border shrink-0",
                      isToday && "bg-gantt-today/10",
                      isWeekend && "bg-muted/50"
                    )}
                    style={{ width: colWidth }}
                  >
                    <span className="text-[10px] text-muted-foreground">{dayName}</span>
                    <span className={cn("text-sm font-semibold", isToday ? "text-gantt-today" : "text-foreground")}>{dayNum}</span>
                    <span className="text-[10px] text-muted-foreground">{monthName}</span>
                  </div>
                );
              })}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Grid lines */}
              {days.map((day, i) => {
                const { isToday, isWeekend } = formatDay(day);
                return (
                  <div
                    key={i}
                    className={cn(
                      "absolute top-0 bottom-0 border-r border-gantt-grid",
                      isToday && "bg-gantt-today/5",
                      isWeekend && "bg-muted/30"
                    )}
                    style={{ left: i * colWidth, width: colWidth, height: projects.length * rowHeight }}
                  />
                );
              })}

              {/* Today line */}
              {days.findIndex(d => d.toISOString().split('T')[0] === todayStr) >= 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gantt-today z-20"
                  style={{
                    left: days.findIndex(d => d.toISOString().split('T')[0] === todayStr) * colWidth + colWidth / 2,
                    height: projects.length * rowHeight,
                  }}
                />
              )}

              {/* Project bars */}
              {projects.map((project, idx) => {
                const { left, width } = getBarPosition(project);
                const inst = getInstaller(project.assigneeId);
                const instColor = inst ? installerBgMap[inst.color] : 'bg-muted';

                return (
                  <div
                    key={project.id}
                    className={cn("border-b border-gantt-grid", idx % 2 === 0 ? "" : "bg-muted/10")}
                    style={{ height: rowHeight }}
                  >
                    <motion.div
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: idx * 0.05, ease: "easeOut" }}
                      style={{ left: Math.max(left, 0), width: Math.max(width, 20), originX: 0, top: 8 }}
                      className={cn(
                        "absolute h-9 rounded-md border-l-[3px] flex items-center px-3 cursor-pointer transition-shadow hover:shadow-md",
                        statusBorderMap[project.status],
                        instColor
                      )}
                      onClick={() => setSelectedProject(project)}
                    >
                      <span className="text-xs font-medium text-foreground truncate">{project.name}</span>
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          installer={getInstaller(selectedProject.assigneeId) ?? null}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  );
};

export default GanttChart;
