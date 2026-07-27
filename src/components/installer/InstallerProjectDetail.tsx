import { ArrowLeft, MapPin, Clock, Users, FileText, Phone, Camera, CheckSquare, ExternalLink, Info, Paperclip, ClipboardCheck, Mail, Receipt } from 'lucide-react';
import { type Project, type Installer, projectTypeIcons, projectTypeLabels, statusLabels, installers } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useState } from 'react';
import ProjectLogTab from '@/components/installer/logs/ProjectLogTab';
import type { InstallerLogs } from '@/hooks/useInstallerLogs';

interface InstallerProjectDetailProps {
  project: Project;
  installer: Installer;
  logs: InstallerLogs;
  onBack: () => void;
  onStatusChange?: (projectId: string, newStatus: Project['status']) => void;
  onPickUp?: () => void;
}

const statusDotMap: Record<string, string> = {
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
  'open': 'bg-status-open',
};

const InstallerProjectDetail = ({ project, installer, logs, onBack, onStatusChange, onPickUp }: InstallerProjectDetailProps) => {
  const [reportPhotos, setReportPhotos] = useState<string[]>([]);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.location)}`;

  const isUnassigned = project.assigneeIds.length === 0;

  // Determine which bottom action to show
  const showStartButton = project.status === 'scheduled' && onStatusChange;
  const showCompleteButton = project.status === 'in-progress' && onStatusChange;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-primary-foreground/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold truncate">{project.name}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-80">{project.id}</span>
            <div className="flex items-center gap-1">
              <div className={cn("w-2 h-2 rounded-full", statusDotMap[project.status])} />
              <span className="text-xs opacity-80">{statusLabels[project.status]}</span>
            </div>
          </div>
        </div>
        <span className="text-xs font-medium bg-primary-foreground/15 px-2 py-1 rounded-md">
          {projectTypeIcons[project.projectType]} {projectTypeLabels[project.projectType]}
        </span>
      </header>

      {/* Pick Up banner for unassigned orders */}
      {isUnassigned && onPickUp && (
        <div className="shrink-0 bg-status-open/10 border-b border-status-open/30 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Unassigned order</span>
          <Button size="sm" onClick={onPickUp} className="text-xs h-8">
            Pick Up Order
          </Button>
        </div>
      )}

      {/* Tabbed content */}
      <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 w-full rounded-none border-b border-border bg-card h-10 p-0 justify-start gap-0">
          <TabsTrigger value="info" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[11px] h-full gap-1">
            <Info className="w-3 h-3" />
            Info
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[11px] h-full gap-1">
            <Paperclip className="w-3 h-3" />
            Docs & Pics
          </TabsTrigger>
          <TabsTrigger value="report" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[11px] h-full gap-1">
            <Camera className="w-3 h-3" />
            Report
          </TabsTrigger>
          <TabsTrigger value="log" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[11px] h-full gap-1">
            <Receipt className="w-3 h-3" />
            Log
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[11px] h-full gap-1">
            <ClipboardCheck className="w-3 h-3" />
            Sign-off
          </TabsTrigger>
        </TabsList>

        {/* INFO TAB */}
        <TabsContent value="info" className="flex-1 overflow-auto mt-0">
          <div className="p-4 space-y-4">
            {/* Schedule */}
            <Section title="Schedule">
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Start" value={`${project.startDate}${project.startTime ? ` at ${project.startTime}` : ''}`} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="End" value={`${project.endDate}${project.endTime ? ` at ${project.endTime}` : ''}`} />
              {project.estimatedHours && (
                <InfoRow icon={<Clock className="w-4 h-4" />} label="Est. Hours" value={`${project.estimatedHours}h`} />
              )}
            </Section>

            {/* Location */}
            <Section title="Location">
              <InfoRow icon={<FileText className="w-4 h-4" />} label="Client" value={project.client} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={project.location} />
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1 text-xs font-medium text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Open in Google Maps
              </a>
              {project.projectNumber && (
                <InfoRow icon={<FileText className="w-4 h-4" />} label="Project #" value={project.projectNumber} />
              )}
            </Section>

            {/* Contact */}
            {(project.contactName || project.contactPhone || project.contactEmail) && (
              <Section title="Contact">
                {project.contactName && (
                  <InfoRow icon={<Users className="w-4 h-4" />} label="Name" value={project.contactName} />
                )}
                {project.contactPhone && (
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="text-muted-foreground"><Phone className="w-4 h-4" /></span>
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Phone</span>
                    <a href={`tel:${project.contactPhone}`} className="text-sm text-primary hover:underline">{project.contactPhone}</a>
                  </div>
                )}
                {project.contactEmail && (
                  <div className="flex items-center gap-2 py-0.5">
                    <span className="text-muted-foreground"><Mail className="w-4 h-4" /></span>
                    <span className="text-xs text-muted-foreground w-20 shrink-0">Email</span>
                    <a href={`mailto:${project.contactEmail}`} className="text-sm text-primary hover:underline">{project.contactEmail}</a>
                  </div>
                )}
              </Section>
            )}

            {/* Team */}
            {project.assigneeIds.length > 0 && (
              <Section title="Team">
                {project.assigneeIds.map(id => {
                  const inst = installers.find(i => i.id === id);
                  if (!inst) return null;
                  const isMe = inst.id === installer.id;
                  return (
                    <div key={id} className="flex items-center gap-2 py-1">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground">
                        {inst.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-sm text-foreground">{inst.name}</span>
                      {isMe && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">You</span>}
                      {inst.type === 'sub-vendor' && <span className="text-[10px] text-muted-foreground">(SUB)</span>}
                    </div>
                  );
                })}
              </Section>
            )}

            {/* Description */}
            {project.description && (
              <Section title="Description">
                <p className="text-sm text-foreground leading-relaxed">{project.description}</p>
              </Section>
            )}

            {/* Route for transport */}
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
          </div>
        </TabsContent>

        {/* DOCS & PICS TAB */}
        <TabsContent value="docs" className="flex-1 overflow-auto mt-0">
          <div className="p-4 space-y-4">
            <Section title="Pictures & Documentation">
              {project.attachments && project.attachments.length > 0 ? (
                project.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 py-1.5">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground flex-1">{att.name}</span>
                    <span className="text-xs text-muted-foreground">{(att.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No documents attached</p>
              )}
            </Section>
          </div>
        </TabsContent>

        {/* REPORT TAB */}
        <TabsContent value="report" className="flex-1 overflow-auto mt-0">
          <div className="p-4 space-y-4">
            <Section title="Add Photos / Reporting">
              <p className="text-xs text-muted-foreground mb-3">Take photos of the work progress or completed installation.</p>
              <button
                className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  const id = `photo-${Date.now()}`;
                  setReportPhotos(prev => [...prev, id]);
                }}
              >
                <Camera className="w-8 h-8 text-muted-foreground/50" />
                <span className="text-xs font-medium text-muted-foreground">Tap to add photo</span>
              </button>
              {reportPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {reportPhotos.map((id) => (
                    <div key={id} className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                      <Camera className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </TabsContent>

        {/* LOG TAB */}
        <TabsContent value="log" className="flex-1 overflow-auto mt-0">
          <ProjectLogTab projectId={project.id} logs={logs} />
        </TabsContent>



        {/* SUMMARY / SIGN-OFF TAB */}
        <TabsContent value="summary" className="flex-1 overflow-auto mt-0">
          <div className="p-4 space-y-4">
            <Section title="Summary">
              <InfoRow icon={<FileText className="w-4 h-4" />} label="Project" value={project.name} />
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Location" value={project.location} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="Period" value={`${project.startDate} → ${project.endDate}`} />
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-muted-foreground"><Users className="w-4 h-4" /></span>
                <span className="text-xs text-muted-foreground w-20 shrink-0">Status</span>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-2.5 h-2.5 rounded-full", statusDotMap[project.status])} />
                  <span className="text-sm text-foreground">{statusLabels[project.status]}</span>
                </div>
              </div>
              {reportPhotos.length > 0 && (
                <InfoRow icon={<Camera className="w-4 h-4" />} label="Photos" value={`${reportPhotos.length} added`} />
              )}
            </Section>

            <Section title="Sign-off">
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold text-foreground mb-2">Installer Sign-off</p>
                  <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Tap to sign</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3 opacity-60">
                  <p className="text-xs font-semibold text-foreground mb-1">Client Sign-off</p>
                  <p className="text-[10px] text-muted-foreground mb-2">Enabled when admin requires client signature</p>
                  <div className="h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">Client signature area</p>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </TabsContent>
      </Tabs>

      {/* Sticky bottom action button */}
      {(showStartButton || showCompleteButton) && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
          {showStartButton && (
            <Button
              className="w-full bg-status-in-progress hover:bg-status-in-progress/90 text-foreground"
              size="lg"
              onClick={() => onStatusChange!(project.id, 'in-progress')}
            >
              ▶ Start Project
            </Button>
          )}
          {showCompleteButton && (
            <Button
              className="w-full bg-status-completed hover:bg-status-completed/90 text-foreground"
              size="lg"
              onClick={() => onStatusChange!(project.id, 'completed')}
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              Mark Complete
            </Button>
          )}
        </div>
      )}
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
