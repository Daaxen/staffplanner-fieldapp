import { useMemo, useState } from 'react';
import { ArrowLeft, FolderKanban, Link2, Pencil, Plus, Trash2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { statusLabels, type Project } from '@/data/mockData';
import { clientRowId, useClients, useProjects } from '@/lib/appData';
import CreateOrderDialog from '@/components/gantt/CreateOrderDialog';
import {
  createProjectGroup, deleteProjectGroup, updateProjectGroup, useProjectGroups,
  type ProjectGroup, type ProjectGroupInput,
} from '@/lib/projectGroups';

const emptyForm: ProjectGroupInput = {
  name: '',
  projectNumber: '',
  clientId: '',
  description: '',
  startDate: '',
  endDate: '',
};

const ProjectGroupsRegister = () => {
  const { groups, loading, reload } = useProjectGroups();
  const [orders, setOrders] = useProjects();
  const [clients] = useClients();

  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectGroupInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSelection, setLinkSelection] = useState<Set<string>>(new Set());
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectGroup | null>(null);

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach(c => {
      const rowId = clientRowId(c.id);
      if (rowId) map.set(rowId, c.name);
    });
    return map;
  }, [clients]);

  const ordersByGroup = useMemo(() => {
    const map = new Map<string, Project[]>();
    orders.forEach(o => {
      if (!o.projectGroupId) return;
      const list = map.get(o.projectGroupId) ?? [];
      list.push(o);
      map.set(o.projectGroupId, list);
    });
    return map;
  }, [orders]);

  const openGroup = openId ? groups.find(g => g.id === openId) ?? null : null;
  const groupOrders = openGroup ? ordersByGroup.get(openGroup.id) ?? [] : [];

  const setLink = (orderIds: string[], groupId: string | undefined) => {
    setOrders(prev => prev.map(o => (orderIds.includes(o.id) ? { ...o, projectGroupId: groupId } : o)));
  };

  const startCreate = () => { setEditId(null); setForm({ ...emptyForm }); };
  const startEdit = (g: ProjectGroup) => {
    setEditId(g.id);
    setForm({
      name: g.name,
      projectNumber: g.projectNumber ?? '',
      clientId: g.clientId ?? '',
      description: g.description ?? '',
      startDate: g.startDate ?? '',
      endDate: g.endDate ?? '',
    });
  };

  const saveForm = async () => {
    if (!form?.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await updateProjectGroup(editId, form);
        toast.success('Project updated');
      } else {
        await createProjectGroup(form);
        toast.success('Project created');
      }
      setForm(null);
      setEditId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the project');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const affected = (ordersByGroup.get(deleteTarget.id) ?? []).map(o => o.id);
      await deleteProjectGroup(deleteTarget.id);
      if (affected.length > 0) setLink(affected, undefined);
      toast.success('Project removed. Its work orders are now standalone.');
      setDeleteTarget(null);
      if (openId === deleteTarget.id) setOpenId(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove the project');
    }
  };

  const linkableOrders = useMemo(
    () => orders.filter(o => o.projectGroupId !== openGroup?.id),
    [orders, openGroup],
  );

  const applyLink = () => {
    if (!openGroup) return;
    setLink(Array.from(linkSelection), openGroup.id);
    toast.success(`${linkSelection.size} work order(s) added to the project`);
    setLinkSelection(new Set());
    setLinkOpen(false);
  };

  /* ------------------------------ detail view ----------------------------- */
  if (openGroup) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border bg-card px-6 py-4 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Projects
          </Button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-xl font-semibold text-foreground">{openGroup.name}</h1>
            <p className="text-xs text-muted-foreground">
              {[openGroup.projectNumber, clientNameById.get(openGroup.clientId ?? ''),
                [openGroup.startDate, openGroup.endDate].filter(Boolean).join(' – ')]
                .filter(Boolean).join(' · ') || 'No details yet'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => startEdit(openGroup)}>
            <Pencil className="w-4 h-4 mr-1.5" /> Edit project
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setLinkSelection(new Set()); setLinkOpen(true); }}>
            <Link2 className="w-4 h-4 mr-1.5" /> Add existing work orders
          </Button>
          <Button size="sm" onClick={() => setCreateOrderOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Create work order
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {openGroup.description && (
            <p className="text-sm text-muted-foreground mb-4">{openGroup.description}</p>
          )}
          {groupOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work orders in this project yet.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Work order</th>
                    <th className="text-left px-3 py-2">Customer</th>
                    <th className="text-left px-3 py-2">Period</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {groupOrders.map(o => (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <span className="font-medium text-foreground">{o.name}</span>
                        <span className="ml-2 text-xs font-mono text-muted-foreground">{o.id}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{o.client}</td>
                      <td className="px-3 py-2 text-muted-foreground">{o.startDate} – {o.endDate}</td>
                      <td className="px-3 py-2 text-muted-foreground">{statusLabels[o.status]}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setLink([o.id], undefined)}>
                          <Unlink className="w-3.5 h-3.5 mr-1" /> Remove from project
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add existing work orders</DialogTitle>
              <DialogDescription>
                A work order belongs to at most one project. Picking one here moves it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              {linkableOrders.length === 0 && (
                <p className="text-sm text-muted-foreground">No other work orders available.</p>
              )}
              {linkableOrders.map(o => (
                <label key={o.id} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={linkSelection.has(o.id)}
                    onCheckedChange={() =>
                      setLinkSelection(prev => {
                        const next = new Set(prev);
                        next.has(o.id) ? next.delete(o.id) : next.add(o.id);
                        return next;
                      })
                    }
                  />
                  <span className="font-medium">{o.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {o.client} · {o.startDate}
                    {o.projectGroupId ? ' · currently in another project' : ' · standalone'}
                  </span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
              <Button onClick={applyLink} disabled={linkSelection.size === 0}>Add selected</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CreateOrderDialog
          open={createOrderOpen}
          onOpenChange={setCreateOrderOpen}
          projectGroupId={openGroup.id}
          onCreateOrder={(p) => setOrders(prev => [...prev, p])}
        />

        {form && (
          <ProjectFormDialog
            form={form}
            setForm={setForm}
            onClose={() => { setForm(null); setEditId(null); }}
            onSave={saveForm}
            saving={saving}
            editing={!!editId}
            clients={clients.map(c => ({ id: clientRowId(c.id) ?? '', name: c.name })).filter(c => c.id)}
          />
        )}
      </div>
    );
  }

  /* ------------------------------- list view ------------------------------ */
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card px-6 py-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <p className="text-xs text-muted-foreground">
            A project groups several work orders. Work orders can also stand alone.
          </p>
        </div>
        <Button size="sm" onClick={startCreate}>
          <Plus className="w-4 h-4 mr-1.5" /> New project
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderKanban className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No projects yet. Create one to group related work orders.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {groups.map(g => {
              const list = ordersByGroup.get(g.id) ?? [];
              const done = list.filter(o => o.status === 'completed').length;
              return (
                <div
                  key={g.id}
                  className={cn(
                    'border border-border rounded-lg p-4 bg-card hover:border-primary/50 transition-colors cursor-pointer',
                  )}
                  onClick={() => setOpenId(g.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[g.projectNumber, clientNameById.get(g.clientId ?? '')].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => startEdit(g)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(g)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {list.length} work order{list.length === 1 ? '' : 's'} · {done} completed
                  </p>
                  {(g.startDate || g.endDate) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {[g.startDate, g.endDate].filter(Boolean).join(' – ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {form && (
        <ProjectFormDialog
          form={form}
          setForm={setForm}
          onClose={() => { setForm(null); setEditId(null); }}
          onSave={saveForm}
          saving={saving}
          editing={!!editId}
          clients={clients.map(c => ({ id: clientRowId(c.id) ?? '', name: c.name })).filter(c => c.id)}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove project</DialogTitle>
            <DialogDescription>
              {deleteTarget?.name} will be removed. Its work orders stay and become standalone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface FormDialogProps {
  form: ProjectGroupInput;
  setForm: (f: ProjectGroupInput) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  editing: boolean;
  clients: { id: string; name: string }[];
}

const ProjectFormDialog = ({ form, setForm, onClose, onSave, saving, editing, clients }: FormDialogProps) => (
  <Dialog open onOpenChange={(o) => !o && onClose()}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit project' : 'New project'}</DialogTitle>
        <DialogDescription>A project groups several work orders.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Name</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Project number</Label>
            <Input value={form.projectNumber ?? ''} onChange={e => setForm({ ...form, projectNumber: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Customer</Label>
            <Select
              value={form.clientId || 'none'}
              onValueChange={v => setForm({ ...form, clientId: v === 'none' ? '' : v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No customer</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Start date</Label>
            <Input type="date" value={form.startDate ?? ''} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label>End date</Label>
            <Input type="date" value={form.endDate ?? ''} onChange={e => setForm({ ...form, endDate: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Description</Label>
          <Textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave} disabled={saving || !form.name.trim()}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create project'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ProjectGroupsRegister;
