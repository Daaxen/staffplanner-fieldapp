import { useEffect, useState } from 'react';
import { X, MapPin, User, Calendar, Tag, Phone, Mail, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Project, type Installer, statusLabels, type ProjectStatus, installers } from '@/data/mockData';
import { motion, AnimatePresence } from 'framer-motion';
import SimilarJobsPanel from '@/components/orders/SimilarJobsPanel';
import HistoricalEstimateCard from '@/components/orders/HistoricalEstimateCard';
import CancelWorkOrderDialog from '@/components/gantt/CancelWorkOrderDialog';

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
  onEdit?: (project: Project) => void;
  onDispatch?: (project: Project) => void;
}

const ProjectDetailPanel = ({ project, installer, onClose, onEdit, onDispatch }: Props) => {
  const assignees = project.assigneeIds.map(id => installers.find(i => i.id === id)).filter(Boolean) as Installer[];
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      {/* Backdrop - click outside to close */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="fixed right-0 top-0 bottom-0 w-96 bg-card border-l border-border shadow-2xl z-50 flex flex-col"
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-base font-semibold text-foreground">Work order details</h3>
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
                {assignees.length > 0 ? assignees.map(a => (
                  <div key={a.id} className="flex items-center gap-2 mt-1">
                    <div className={cn("w-3 h-3 rounded-full", installerDotMap[a.color])} />
                    <p className="text-sm font-medium text-foreground">{a.name}</p>
                    {a.type === 'sub-vendor' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">SUB</span>
                    )}
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground italic mt-1">Unassigned</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact */}
          {(project.contactName || project.contactPhone || project.contactEmail) && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</p>
              {project.contactName && (
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-medium text-foreground">{project.contactName}</p>
                  </div>
                </div>
              )}
              {project.contactPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <a href={`tel:${project.contactPhone}`} className="text-sm font-medium text-primary hover:underline">{project.contactPhone}</a>
                  </div>
                </div>
              )}
              {project.contactEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <a href={`mailto:${project.contactEmail}`} className="text-sm font-medium text-primary hover:underline">{project.contactEmail}</a>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-border space-y-4">
            <HistoricalEstimateCard project={project} />
            <SimilarJobsPanel project={project} />
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-4 border-t border-border">
            <button
              onClick={() => onDispatch?.(project)}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Dispatch work order
            </button>
            <button
              onClick={() => onEdit?.(project)}
              className="w-full py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Edit work order
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProjectDetailPanel;
