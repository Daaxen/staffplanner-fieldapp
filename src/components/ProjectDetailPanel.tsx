import { X, MapPin, User, Calendar, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Project, type Installer, statusLabels, type ProjectStatus, installers } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';

const statusColorMap: Record<ProjectStatus, string> = {
  'open': 'bg-status-open/15 text-status-open',
  'scheduled': 'bg-status-scheduled/15 text-status-scheduled',
  'in-progress': 'bg-status-in-progress/15 text-status-in-progress',
  'completed': 'bg-status-completed/15 text-status-completed',
  'on-hold': 'bg-status-on-hold/15 text-status-on-hold',
  'cancelled': 'bg-status-cancelled/15 text-status-cancelled',
};

const installerDotMap: Record<number, string> = {
  1: 'bg-installer-1',
  2: 'bg-installer-2',
  3: 'bg-installer-3',
  4: 'bg-installer-4',
  5: 'bg-installer-5',
  6: 'bg-installer-6',
};

interface Props {
  project: Project;
  installer: Installer | null;
  onClose: () => void;
}

const ProjectDetailPanel = ({ project, installer, onClose }: Props) => {
  const assignees = project.assigneeIds.map(id => installers.find(i => i.id === id)).filter(Boolean) as Installer[];
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="fixed right-0 top-0 bottom-0 w-96 bg-card border-l border-border shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Project Details</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div>
            <h4 className="text-lg font-semibold text-foreground">{project.name}</h4>
            <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium mt-2", statusColorMap[project.status])}>
              {statusLabels[project.status]}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Client</p>
                <p className="text-sm font-medium text-foreground">{project.client}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="text-sm font-medium text-foreground">{project.location}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Schedule</p>
                <p className="text-sm font-medium text-foreground">{formatDate(project.startDate)} → {formatDate(project.endDate)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Tag className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Assigned to</p>
                {installer && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className={cn("w-3 h-3 rounded-full", installerDotMap[installer.color])} />
                    <p className="text-sm font-medium text-foreground">{installer.name}</p>
                    {installer.type === 'sub-vendor' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">SUB</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-4 border-t border-border">
            <button className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              Dispatch Order
            </button>
            <button className="w-full py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
              Edit Project
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProjectDetailPanel;
