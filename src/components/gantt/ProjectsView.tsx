import { cn } from '@/lib/utils';
import { type Project, type Installer, type ProjectStatus, installers } from '@/data/mockData';
import { motion } from 'framer-motion';
import GanttHeader from './GanttHeader';
import GanttGrid from './GanttGrid';

const statusColorMap: Record<ProjectStatus, string> = {
  'open': 'bg-status-open',
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'confirmed': 'bg-status-confirmed',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
};

const statusBorderMap: Record<ProjectStatus, string> = {
  'open': 'border-status-open',
  'scheduled': 'border-status-scheduled',
  'in-progress': 'border-status-in-progress',
  'confirmed': 'border-status-confirmed',
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

interface ProjectsViewProps {
  projects: Project[];
  days: Date[];
  colWidth: number;
  startDate: Date;
  todayStr: string;
  onSelectProject: (project: Project) => void;
}

const rowHeight = 52;
const headerHeight = 60;
const labelWidth = 260;

const ProjectsView = ({ projects, days, colWidth, startDate, todayStr, onSelectProject }: ProjectsViewProps) => {
  const getInstaller = (id: string | null) => id ? installers.find(i => i.id === id) : null;

  const getBarPosition = (project: Project) => {
    const pStart = new Date(project.startDate);
    const pEnd = new Date(project.endDate);
    const startDiff = Math.floor((pStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.floor((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return { left: startDiff * colWidth, width: duration * colWidth - 4 };
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Labels */}
      <div className="shrink-0 border-r border-border bg-card" style={{ width: labelWidth }}>
        <div className="sticky top-0 z-10">
          <div className="border-b border-border bg-gantt-header" style={{ height: 24 }} />
          <div className="border-b border-border flex items-center px-4 bg-gantt-header" style={{ height: headerHeight - 24 }}>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project</span>
          </div>
        </div>
        {projects.map((project, idx) => {
          const inst = getInstaller(project.assigneeId);
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
                <p className="text-xs text-muted-foreground truncate">{inst?.name ?? '— Unassigned —'}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-x-auto gantt-scroll">
        <div style={{ minWidth: days.length * colWidth }}>
          <GanttHeader days={days} colWidth={colWidth} headerHeight={headerHeight} todayStr={todayStr} />
          <div className="relative">
            <GanttGrid days={days} colWidth={colWidth} totalHeight={projects.length * rowHeight} todayStr={todayStr} />
            {projects.map((project, idx) => {
              const { left, width } = getBarPosition(project);
              const inst = getInstaller(project.assigneeId);
              const instColor = inst ? installerBgMap[inst.color] : 'bg-muted/40';
              return (
                <div
                  key={project.id}
                  className={cn("border-b border-gantt-grid", idx % 2 === 0 ? "" : "bg-muted/10")}
                  style={{ height: rowHeight }}
                >
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ duration: 0.4, delay: idx * 0.03, ease: "easeOut" }}
                    style={{ left: Math.max(left, 0), width: Math.max(width, 20), originX: 0, top: 8 }}
                    className={cn(
                      "absolute h-9 rounded-md border-l-[3px] flex items-center px-3 cursor-pointer transition-shadow hover:shadow-md",
                      statusBorderMap[project.status],
                      instColor
                    )}
                    onClick={() => onSelectProject(project)}
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
  );
};

export default ProjectsView;
