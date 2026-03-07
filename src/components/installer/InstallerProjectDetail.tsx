import { ArrowLeft, MapPin, Clock, Users, FileText, Phone } from 'lucide-react';
import { type Project, type Installer, projectTypeIcons, projectTypeLabels, statusLabels } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface InstallerProjectDetailProps {
  project: Project;
  installer: Installer;
  onBack: () => void;
}

const statusDotMap: Record<string, string> = {
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
  'open': 'bg-status-open',
};

const InstallerProjectDetail = ({ project, installer, onBack }: InstallerProjectDetailProps) => {
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-primary-foreground/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold truncate">{project.name}</h1>
          <p className="text-xs opacity-80">{project.id}</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {/* Status Banner */}
        <div className="px-4 py-3 bg-card border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", statusDotMap[project.status])} />
            <span className="text-sm font-medium text-foreground">{statusLabels[project.status]}</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-md bg-muted">
            {projectTypeIcons[project.projectType]} {projectTypeLabels[project.projectType]}
          </span>
        </div>

        {/* Details */}
        <div className="p-4 space-y-4">
          {/* Client & Location */}
          <Section title="Client & Location">
            <InfoRow icon={<FileText className="w-4 h-4" />} label="Client" value={project.client} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Location" value={project.location} />
            {project.projectNumber && (
              <InfoRow icon={<FileText className="w-4 h-4" />} label="Project Number" value={project.projectNumber} />
            )}
          </Section>

          {/* Schedule */}
          <Section title="Schedule">
            <InfoRow icon={<Clock className="w-4 h-4" />} label="Start" value={`${project.startDate}${project.startTime ? ` at ${project.startTime}` : ''}`} />
            <InfoRow icon={<Clock className="w-4 h-4" />} label="End" value={`${project.endDate}${project.endTime ? ` at ${project.endTime}` : ''}`} />
            {project.estimatedHours && (
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Est. Hours" value={`${project.estimatedHours}h`} />
            )}
          </Section>

          {/* Team */}
          {project.assigneeIds.length > 1 && (
            <Section title="Team">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{project.assigneeIds.length} installers assigned</span>
              </div>
            </Section>
          )}

          {/* Description */}
          {project.description && (
            <Section title="Description">
              <p className="text-sm text-foreground leading-relaxed">{project.description}</p>
            </Section>
          )}

          {/* Transport Stops */}
          {project.transportStops && project.transportStops.length > 0 && (
            <Section title="Route">
              {project.transportStops.map((stop, i) => (
                <div key={stop.id} className="flex items-start gap-2 py-1.5">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {stop.type === 'pickup' ? '📦 Pickup' : '📍 Delivery'}
                    </p>
                    <p className="text-xs text-muted-foreground">{stop.address}</p>
                    {stop.contactName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {stop.contactName} {stop.contactPhone && `· ${stop.contactPhone}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Attachments */}
          {project.attachments && project.attachments.length > 0 && (
            <Section title="Attachments">
              {project.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 py-1">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{att.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{(att.size / 1024).toFixed(0)} KB</span>
                </div>
              ))}
            </Section>
          )}

          {/* Actions placeholder */}
          <div className="pt-4 space-y-2">
            {project.status === 'scheduled' && (
              <Button className="w-full bg-status-in-progress hover:bg-status-in-progress/90 text-foreground" size="lg">
                ▶ Start Project
              </Button>
            )}
            {project.status === 'in-progress' && (
              <Button className="w-full bg-status-completed hover:bg-status-completed/90 text-foreground" size="lg">
                ✅ Mark Complete
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl bg-card p-3 shadow-sm">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
    <div className="space-y-1">{children}</div>
  </div>
);

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-2 py-0.5">
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
    <span className="text-sm text-foreground">{value}</span>
  </div>
);

export default InstallerProjectDetail;
