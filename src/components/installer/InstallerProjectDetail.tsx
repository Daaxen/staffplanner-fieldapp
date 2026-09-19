import { ArrowLeft, MapPin, Clock, Users, FileText, Phone, Camera, CheckSquare, ExternalLink, Info, Paperclip, ClipboardCheck, Mail, Receipt, AlertCircle, Check, X } from 'lucide-react';
import { type Project, type Installer, projectTypeIcons, projectTypeLabels, statusLabels, installers } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { useClients } from '@/lib/appData';
import { customerFieldInfo } from '@/lib/customerLink';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  checklistFor,
  completionRequirements,
  minPhotosFor,
  missingRequirements,
  signOffsFor,
} from '@/lib/completionRequirements';
import { templateForProject } from '@/lib/projectTemplates';
import ProjectLogTab from '@/components/installer/reporting/ProjectLogTab';
import type { InstallerLogs } from '@/hooks/useInstallerLogs';
import MiniMap from '@/components/maps/MiniMap';
import PhotoManager from '@/components/installer/PhotoManager';

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
  
  const [tab, setTab] = useState('info');
  // Same saved field report, offline queue and sync as technician mode.
  const { work, state: completionState, update, replace, loaded, online } = useFieldWork(project.id, project.name);
  const { checkedItems, reportText, reportSubmitted, signature } = work;
  const signOffs = work.signOffs ?? {};
  const photoCount = work.photos.length;


  const [clientRows] = useClients();
  const customer = useMemo(
    () => customerFieldInfo(project, clientRows),
    [project.clientId, project.client, clientRows],
  );

  const template = useMemo(() => templateForProject(project), [project.templateId, project.projectType]);
  const checklist = checklistFor(template);
  const minPhotos = minPhotosFor(template);
  const templateSignOffs = signOffsFor(template);

  const completionState = {
    photoCount,
    checkedItems,
    signature,
    reportSubmitted,
    signOffs,
  };
  const requirements = useMemo(
    () => completionRequirements(completionState, template),
    [photoCount, checkedItems, signature, reportSubmitted, signOffs, template],
  );
  const missing = requirements.filter(r => !r.met);
  const readyToComplete = missing.length === 0;

  const toggleCheck = (id: string) =>
    setCheckedItems(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));

  const handleComplete = () => {
    const blockers = missingRequirements(completionState, template);
    if (blockers.length > 0) {
      setTab('summary');
      toast.error('Cannot complete yet', {
        description: blockers.map(b => b.label.replace(/\s*\(.*\)$/, '')).join(' · '),
      });
      return;
    }
    onStatusChange!(project.id, 'completed');
  };

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
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
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

            {/* Customer — name, address and contact only, never commercial data */}
            <Section title="Customer">
              <InfoRow
                icon={<FileText className="w-4 h-4" />}
                label="Client"
                value={customer?.name ?? project.client}
              />
              {customer?.address && (
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={customer.address} />
              )}
              {customer?.contactName && (
                <InfoRow
                  icon={<Users className="w-4 h-4" />}
                  label="Contact"
                  value={[customer.contactName, customer.contactRole].filter(Boolean).join(' · ')}
                />
              )}
              {customer?.contactPhone && (
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-muted-foreground"><Phone className="w-4 h-4" /></span>
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Phone</span>
                  <a href={`tel:${customer.contactPhone}`} className="text-sm text-primary hover:underline">{customer.contactPhone}</a>
                </div>
              )}
              {customer?.contactEmail && (
                <div className="flex items-center gap-2 py-0.5">
                  <span className="text-muted-foreground"><Mail className="w-4 h-4" /></span>
                  <span className="text-xs text-muted-foreground w-20 shrink-0">Email</span>
                  <a href={`mailto:${customer.contactEmail}`} className="text-sm text-primary hover:underline">{customer.contactEmail}</a>
                </div>
              )}
            </Section>

            {/* Location */}
            <Section title="Location">
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={project.location} />
              {project.location?.trim() && (
                <MiniMap
                  className="mt-2"
                  address={project.location}
                  lat={project.locationLat}
                  lng={project.locationLng}
                  height={150}
                  showLink={false}
                />
              )}
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
              <p className="text-xs text-muted-foreground mb-3">
                Pick a category, then take the photo — the time and GPS position are saved automatically, and you can add a comment to each photo.
              </p>
              <PhotoManager
                projectRef={project.id}
                projectName={project.name}
                onCountChange={setPhotoCount}
                requiredShots={template?.photos}
                minPhotos={minPhotos}
              />
            </Section>

            <Section title="Completion Checklist">
              <div className="space-y-2">
                {checklist.map(item => (
                  <label key={item.id} className="flex items-start gap-2 py-1 cursor-pointer">
                    <Checkbox
                      checked={checkedItems.includes(item.id)}
                      onCheckedChange={() => toggleCheck(item.id)}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-foreground leading-snug">{item.label}</span>
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Installation Report">
              <Textarea
                value={reportText}
                maxLength={2000}
                onChange={e => {
                  setReportText(e.target.value);
                  setReportSubmitted(false);
                }}
                placeholder="Describe the work performed, deviations and any follow-up needed…"
                className="min-h-[110px] text-sm"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted-foreground">
                  {reportSubmitted ? 'Report submitted' : 'Not submitted yet'}
                </span>
                <Button
                  size="sm"
                  disabled={reportText.trim().length < 10 || reportSubmitted}
                  onClick={() => {
                    setReportSubmitted(true);
                    toast.success('Installation report submitted');
                  }}
                >
                  Submit report
                </Button>
              </div>
            </Section>
          </div>
        </TabsContent>

        {/* LOG TAB */}
        <TabsContent value="log" className="flex-1 overflow-auto mt-0">
          <ProjectLogTab projectId={project.id} logs={logs} plannedHours={project.estimatedHours} />
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
              {photoCount > 0 && (
                <InfoRow icon={<Camera className="w-4 h-4" />} label="Photos" value={`${photoCount} added`} />
              )}
            </Section>

            <Section title="Completion Requirements">
              <div className="space-y-2">
                {requirements.map(r => (
                  <button
                    key={r.id}
                    onClick={() => !r.met && setTab(r.tab)}
                    className="w-full flex items-start gap-2 text-left py-1"
                  >
                    <span className={cn('mt-0.5 shrink-0', r.met ? 'text-status-completed' : 'text-status-cancelled')}>
                      {r.met ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block text-sm', r.met ? 'text-foreground' : 'font-medium text-foreground')}>
                        {r.label}
                      </span>
                      {!r.met && <span className="block text-[11px] text-muted-foreground">{r.hint}</span>}
                    </span>
                  </button>
                ))}
              </div>
              {!readyToComplete && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-status-on-hold/40 bg-status-on-hold/10 p-2.5">
                  <AlertCircle className="w-4 h-4 text-status-on-hold mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground">
                    {missing.length} requirement{missing.length > 1 ? 's' : ''} missing — the order cannot be marked complete yet.
                  </p>
                </div>
              )}
            </Section>

            <Section title="Sign-off">
              <div className="space-y-3">
                {templateSignOffs.map(so => {
                  const value = so.id === 'customer' ? signature : signOffs[so.id] ?? '';
                  const setValue = (v: string) =>
                    so.id === 'customer'
                      ? setSignature(v)
                      : setSignOffs(prev => ({ ...prev, [so.id]: v }));
                  return (
                    <div key={so.id} className="rounded-lg border border-border p-3">
                      <p className="text-xs font-semibold text-foreground mb-1">{so.label}</p>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Required before the order can be completed.
                      </p>
                      <Input
                        value={value}
                        maxLength={100}
                        onChange={e => setValue(e.target.value)}
                        placeholder={so.by === 'customer' ? 'Customer full name' : 'Your full name'}
                        className="text-sm"
                      />
                      <div className="h-24 mt-2 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                        <p className={cn('text-sm', value.trim() ? 'italic text-foreground' : 'text-muted-foreground text-xs')}>
                          {value.trim() || 'Signature area'}
                        </p>
                      </div>
                    </div>
                  );
                })}
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
            <>
              {!readyToComplete && (
                <div className="mb-2 rounded-lg border border-status-on-hold/40 bg-status-on-hold/10 p-2.5">
                  <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 text-status-on-hold" />
                    Missing before completion
                  </p>
                  <ul className="space-y-0.5">
                    {missing.map(r => (
                      <li key={r.id} className="text-[11px] text-muted-foreground">• {r.label}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                className="w-full bg-status-completed hover:bg-status-completed/90 text-foreground disabled:opacity-50"
                size="lg"
                disabled={!readyToComplete}
                onClick={handleComplete}
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {readyToComplete ? 'Mark Complete' : `Mark Complete (${missing.length} missing)`}
              </Button>
            </>
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
