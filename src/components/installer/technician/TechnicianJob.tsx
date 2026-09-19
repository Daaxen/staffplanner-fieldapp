import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckSquare,
  ChevronRight,
  CloudOff,
  Navigation,
  PenLine,
  Phone,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { type Project } from '@/data/mockData';
import {
  checklistFor,
  completionRequirements,
  minPhotosFor,
  missingRequirements,
  signOffsFor,
} from '@/lib/completionRequirements';
import { templateForProject } from '@/lib/projectTemplates';
import PhotoManager from '@/components/installer/PhotoManager';
import { useFieldWork } from '@/hooks/useFieldWork';
import DeviationForm from '@/components/installer/DeviationForm';

interface TechnicianJobProps {
  project: Project;
  onBack: () => void;
  onStatusChange?: (projectId: string, newStatus: Project['status']) => void;
}

type Panel = 'checklist' | 'photos' | 'signature' | 'deviation' | 'issue' | null;

const TechnicianJob = ({ project, onBack, onStatusChange }: TechnicianJobProps) => {
  const [panel, setPanel] = useState<Panel>(null);
  const { work, state: completionState, update, replace, online } = useFieldWork(project.id, project.name);
  const template = useMemo(() => templateForProject(project), [project.templateId, project.projectType]);
  const checklist = checklistFor(template);
  const minPhotos = minPhotosFor(template);
  const signOffs = signOffsFor(template);
  const requirements = useMemo(
    () => completionRequirements(completionState, template),
    [work.photos.length, work.checkedItems, work.signature, work.reportSubmitted, work.signOffs, template],
  );
  const missing = requirements.filter(r => !r.met);
  const ready = missing.length === 0;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(project.location || '')}`;

  const setStatus = async (status: Project['status']) => {
    await update({ pendingStatus: status });
    onStatusChange?.(project.id, status);
  };

  const complete = async () => {
    if (missingRequirements(completionState, template).length > 0) {
      toast.error('Not ready yet', { description: missing.map(m => m.label).join(' · ') });
      return;
    }
    await setStatus('completed');
    if (!online) toast.success('Job saved offline — it syncs automatically when you reconnect');
    onBack();
  };

  const bigButton = (
    key: Exclude<Panel, null>,
    icon: React.ReactNode,
    label: string,
    status: string,
    done: boolean,
  ) => (
    <button
      key={key}
      onClick={() => setPanel(panel === key ? null : key)}
      className={cn(
        'w-full flex items-center gap-3 rounded-2xl border px-4 py-5 text-left transition-colors active:scale-[0.99]',
        done ? 'border-status-completed/40 bg-status-completed/10' : 'border-border bg-card',
      )}
    >
      <span className={cn('shrink-0', done ? 'text-status-completed' : 'text-primary')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{status}</span>
      </span>
      {done ? <Check className="w-5 h-5 text-status-completed" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
    </button>
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="shrink-0 bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-primary-foreground/10" aria-label="Back">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold truncate">{project.name}</h1>
          <p className="text-xs opacity-80 truncate">{project.location || 'No address'}</p>
        </div>
        {!online && (
          <span className="flex items-center gap-1 rounded-full bg-primary-foreground/20 px-2 py-1 text-[11px] font-medium">
            <CloudOff className="w-3.5 h-3.5" />
            Offline
          </span>
        )}
      </header>

      <div className="flex-1 overflow-auto p-4 pb-40 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-primary text-primary-foreground py-5 font-semibold"
          >
            <Navigation className="w-6 h-6" />
            Navigate
          </a>
          <a
            href={project.contactPhone ? `tel:${project.contactPhone}` : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl py-5 font-semibold border border-border',
              project.contactPhone ? 'bg-card text-foreground' : 'bg-muted text-muted-foreground pointer-events-none',
            )}
          >
            <Phone className="w-6 h-6" />
            {project.contactPhone ? 'Call site' : 'No contact'}
          </a>
        </div>

        {/* Work description — always visible so instructions are never missed */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work description</p>
          {project.description ? (
            <p className="mt-1.5 text-sm text-foreground leading-relaxed">{project.description}</p>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground italic">No work description added</p>
          )}
        </div>

        {bigButton(
          'checklist',
          <CheckSquare className="w-6 h-6" />,
          'Checklist',
          `${work.checkedItems.length}/${checklist.length} done`,
          work.checkedItems.length === checklist.length,
        )}
        {panel === 'checklist' && (
          <div className="rounded-2xl border border-border bg-card p-2 space-y-1">
            {checklist.map(item => {
              const on = work.checkedItems.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() =>
                    update({
                      checkedItems: on
                        ? work.checkedItems.filter(c => c !== item.id)
                        : [...work.checkedItems, item.id],
                    })
                  }
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-4 text-left active:bg-muted"
                >
                  <span
                    className={cn(
                      'w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0',
                      on ? 'bg-status-completed border-status-completed text-background' : 'border-border',
                    )}
                  >
                    {on && <Check className="w-4 h-4" />}
                  </span>
                  <span className="text-base text-foreground leading-snug">{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {bigButton(
          'photos',
          <Camera className="w-6 h-6" />,
          'Photos',
          `${work.photos.length} of ${minPhotos} required`,
          work.photos.length >= minPhotos,
        )}
        {panel === 'photos' && (
          <div className="rounded-2xl border border-border bg-card p-3">
            <PhotoManager
              projectRef={project.id}
              projectName={project.name}
              work={work}
              onWorkChange={replace}
              requiredShots={template?.photos}
              minPhotos={minPhotos}
            />
          </div>
        )}

        {bigButton(
          'signature',
          <PenLine className="w-6 h-6" />,
          'Sign-off',
          signOffs.every(so => (so.id === 'customer' ? work.signature : work.signOffs?.[so.id] ?? '').trim())
            ? 'Signed'
            : `${signOffs.length} sign-off${signOffs.length === 1 ? '' : 's'} required`,
          signOffs.every(so => (so.id === 'customer' ? work.signature : work.signOffs?.[so.id] ?? '').trim()),
        )}
        {panel === 'signature' && (
          <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
            {signOffs.map(so => {
              const value = so.id === 'customer' ? work.signature : work.signOffs?.[so.id] ?? '';
              const setValue = (v: string) =>
                so.id === 'customer'
                  ? update({ signature: v })
                  : update({ signOffs: { ...(work.signOffs ?? {}), [so.id]: v } });
              return (
                <div key={so.id} className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">{so.label}</p>
                  <Input
                    value={value}
                    maxLength={100}
                    onChange={e => setValue(e.target.value)}
                    placeholder={so.by === 'customer' ? 'Customer full name' : 'Your full name'}
                    className="h-12 text-base"
                  />
                  <div className="h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                    <p className={cn(value.trim() ? 'italic text-lg text-foreground' : 'text-sm text-muted-foreground')}>
                      {value.trim() || 'Sign here'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {bigButton(
          'deviation',
          <AlertTriangle className="w-6 h-6" />,
          'Work report',
          work.reportSubmitted ? 'Submitted' : 'Not submitted',
          work.reportSubmitted,
        )}
        {panel === 'deviation' && (
          <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
            <Textarea
              value={work.reportText}
              maxLength={2000}
              onChange={e => update({ reportText: e.target.value, reportSubmitted: false })}
              placeholder="What was done, and any deviation or problem on site…"
              className="min-h-[130px] text-base"
            />
            <Button
              size="lg"
              className="w-full h-12"
              disabled={work.reportText.trim().length < 10 || work.reportSubmitted}
              onClick={() => {
                void update({ reportSubmitted: true });
                toast.success(online ? 'Report submitted' : 'Report saved — uploads when you reconnect');
              }}
            >
              Submit report
            </Button>
          </div>
        )}

        {bigButton(
          'issue',
          <AlertTriangle className="w-6 h-6" />,
          'Report a deviation',
          'Damage, missing goods, access, permits…',
          false,
        )}
        {panel === 'issue' && (
          <DeviationForm
            projectRef={project.id}
            projectName={project.name}
            onDone={() => setPanel(null)}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-card px-4 pt-3 pb-5 space-y-2">
        {!ready && (
          <div className="flex flex-wrap gap-1.5">
            {missing.map(m => (
              <span
                key={m.id}
                className="text-[11px] rounded-full border border-status-on-hold/40 bg-status-on-hold/10 px-2 py-1 text-foreground flex items-center gap-1"
              >
                <X className="w-3 h-3 text-status-on-hold" />
                {m.label}
              </span>
            ))}
          </div>
        )}
        {project.status === 'in-progress' ? (
          <Button
            size="lg"
            disabled={!ready}
            onClick={complete}
            className="w-full h-14 text-base bg-status-completed hover:bg-status-completed/90 text-foreground disabled:opacity-50"
          >
            <CheckSquare className="w-5 h-5 mr-2" />
            {ready ? 'Finish job' : `Finish job (${missing.length} left)`}
          </Button>
        ) : project.status === 'completed' ? (
          <p className="text-center text-sm text-status-completed font-medium py-2">Job completed</p>
        ) : (
          <Button
            size="lg"
            onClick={() => setStatus('in-progress')}
            className="w-full h-14 text-base bg-status-in-progress hover:bg-status-in-progress/90 text-foreground"
          >
            Start job
          </Button>
        )}
      </div>
    </div>
  );
};

export default TechnicianJob;
