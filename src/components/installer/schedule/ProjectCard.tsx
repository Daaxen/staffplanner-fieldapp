import { MapPin, Clock, Users, Truck } from 'lucide-react';
import { type Project, projectTypeIcons, statusLabels, installers } from '@/data/mockData';
import { vehicles } from '@/data/fleetData';
import { cn } from '@/lib/utils';

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

interface ProjectCardProps {
  project: Project;
  onSelect: (p: Project) => void;
  currentInstallerId?: string;
  /** Reported work + travel time for this order. */
  actual?: ActualTime;
}

const ProjectCard = ({ project, onSelect, currentInstallerId, actual }: ProjectCardProps) => {
  const pct = variancePct(project.estimatedHours, actual?.total);
  const coWorkers = project.assigneeIds
    .filter(id => id !== currentInstallerId)
    .map(id => installers.find(i => i.id === id))
    .filter(Boolean);

  const assignedVehicle = vehicles.find(v => v.assignedProjectId === project.id);

  return (
    <div
      className={cn(
        "rounded-xl border-l-[4px] bg-card p-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer",
        statusColorMap[project.status]?.split(' ')[1] || 'border-border'
      )}
      onClick={() => onSelect(project)}
    >
      {/* Row 1: Name & Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {projectTypeIcons[project.projectType]} {project.name}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={cn("w-2 h-2 rounded-full", statusDotMap[project.status])} />
          <span className="text-[10px] text-muted-foreground">{statusLabels[project.status]}</span>
        </div>
      </div>

      {/* Row 2: Time info */}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {project.startDate}{project.startTime ? ` ${project.startTime}` : ''} → {project.endDate}{project.endTime ? ` ${project.endTime}` : ''}
        </span>
        {project.estimatedHours && (
          <span className="shrink-0 text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
            ~{project.estimatedHours}h
          </span>
        )}
      </div>

      {/* Row 3: Client, City, Vehicle */}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
        <span className="truncate">{project.client}</span>
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{project.location}</span>
        {assignedVehicle && (
          <span className="flex items-center gap-1 shrink-0">
            <Truck className="w-3 h-3" />{assignedVehicle.licensePlate}
          </span>
        )}
      </div>

      {/* Co-workers */}
      {coWorkers.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-border/50">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">With:</span>
          {coWorkers.map(inst => (
            <span key={inst!.id} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-medium text-foreground">
              {inst!.name.split(' ')[0]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectCard;
