import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Project, type ProjectStatus, statusLabels } from '@/data/mockData';
import { useClients, useInstallersList, useProjects } from '@/lib/appData';
import { installerConflicts } from '@/lib/schedulingConflicts';
import { toast } from 'sonner';

const statuses: ProjectStatus[] = ['open', 'scheduled', 'in-progress', 'completed', 'on-hold', 'cancelled'];

interface Props {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (projectId: string, updates: Partial<Project>) => void;
}

/**
 * Edit the core fields of a single work order. Bookings and client links are
 * kept in sync by the shared persistence layer (appData -> syncProjectBookings).
 */
const EditWorkOrderDialog = ({ project, open, onOpenChange, onSave }: Props) => {
  const [clients] = useClients();
  const installers = useInstallersList();
  const [allProjects] = useProjects();
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '',
    projectNumber: '',
    clientId: '',
    location: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    status: 'open' as ProjectStatus,
    estimatedHours: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    description: '',
  });

  useEffect(() => {
    if (!project || !open) return;
    setAssigneeIds(project.assigneeIds ?? []);
    setForm({
      name: project.name ?? '',
      projectNumber: project.projectNumber ?? '',
      clientId: project.clientId ?? '',
      location: project.location ?? '',
      startDate: project.startDate ?? '',
      endDate: project.endDate ?? '',
      startTime: project.startTime ?? '',
      endTime: project.endTime ?? '',
      status: project.status,
      estimatedHours: project.estimatedHours != null ? String(project.estimatedHours) : '',
      contactName: project.contactName ?? '',
      contactPhone: project.contactPhone ?? '',
      contactEmail: project.contactEmail ?? '',
      description: project.description ?? '',
    });
  }, [project, open]);

  const set = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleInstaller = (id: string) =>
    setAssigneeIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));

  /** Conflicts (absence, overlap, travel) per selected installer for the edited dates. */
  const conflictsByInstaller = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!project || !form.startDate || !form.endDate) return map;
    for (const id of assigneeIds) {
      const inst = installers.find(i => i.id === id);
      if (!inst) continue;
      const found = installerConflicts(
        inst,
        {
          projectId: project.id,
          name: form.name || project.name,
          startDate: form.startDate,
          endDate: form.endDate,
          startTime: form.startTime,
          endTime: form.endTime,
          location: form.location,
          lat: project.locationLat,
          lng: project.locationLng,
        },
        allProjects,
      );
      if (found.length > 0) map.set(id, found.map(c => c.title));
    }
    return map;
  }, [project, assigneeIds, installers, allProjects, form.startDate, form.endDate, form.startTime, form.endTime, form.location, form.name]);

  const handleSave = () => {
    if (!project) return;
    if (!form.name.trim()) {
      toast.error('The work order needs a name');
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error('Start and end date are required');
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error('The end date cannot be before the start date');
      return;
    }

    const client = clients.find(c => c.id === form.clientId);
    const hours = form.estimatedHours ? Number(form.estimatedHours) : undefined;

    onSave(project.id, {
      name: form.name.trim(),
      projectNumber: form.projectNumber.trim() || undefined,
      clientId: form.clientId || undefined,
      client: client?.name ?? project.client,
      location: form.location.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      status: form.status,
      estimatedHours: hours != null && !Number.isNaN(hours) ? hours : undefined,
      contactName: form.contactName.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      description: form.description.trim() || undefined,
      assigneeIds,
    });

    toast.success('Work order updated');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit work order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="wo-name">Name</Label>
              <Input id="wo-name" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-number">Order number</Label>
              <Input id="wo-number" value={form.projectNumber} onChange={e => set('projectNumber', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Client</Label>
              <Select value={form.clientId} onValueChange={v => set('clientId', v)}>
                <SelectTrigger><SelectValue placeholder={project?.client || 'Select client'} /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="wo-loc">Location</Label>
              <Input id="wo-loc" value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-start">Start date</Label>
              <Input id="wo-start" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-end">End date</Label>
              <Input id="wo-end" type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-stime">Start time</Label>
              <Input id="wo-stime" type="time" value={form.startTime} onChange={e => set('startTime', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-etime">End time</Label>
              <Input id="wo-etime" type="time" value={form.endTime} onChange={e => set('endTime', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-hours">Estimated hours (total for the work order)</Label>
              <Input id="wo-hours" type="number" min="0" step="0.5" value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} />
              <p className="text-xs text-muted-foreground">Total for the whole work order, shared by all assigned installers.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-contact">Contact</Label>
              <Input id="wo-contact" value={form.contactName} onChange={e => set('contactName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-phone">Phone</Label>
              <Input id="wo-phone" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wo-email">Email</Label>
              <Input id="wo-email" type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="wo-desc">Description</Label>
              <Textarea id="wo-desc" rows={3} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Assigned installers</Label>
              {installers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No installers available yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {installers.map(inst => {
                    const selected = assigneeIds.includes(inst.id);
                    const issues = conflictsByInstaller.get(inst.id);
                    return (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => toggleInstaller(inst.id)}
                        title={issues?.join(' · ')}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          selected
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-secondary',
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {inst.name}
                        {selected && issues && <AlertTriangle className="h-3 w-3 text-destructive" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {conflictsByInstaller.size > 0 && (
                <p className="text-xs text-destructive">
                  Scheduling conflict for {[...conflictsByInstaller.keys()]
                    .map(id => installers.find(i => i.id === id)?.name)
                    .filter(Boolean)
                    .join(', ')}. Saving may be rejected by the booking rules.
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditWorkOrderDialog;
