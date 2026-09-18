import { useState, useMemo, useEffect } from 'react';
import { FileText, BookOpen, ShieldAlert, Link2, Plus, Search, Trash2, Download, ExternalLink, Pencil, Lock, Building2, Briefcase, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { docCategoryLabels, docScopeLabels, docScopeHints, type DocCategory, type DocScope } from '@/data/documentsData';
import { useDocuments, type DocDraft } from '@/hooks/useDocuments';
import { useProjects, projectRowId, projectRefForRowId } from '@/lib/appData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const categoryIcon: Record<DocCategory, typeof FileText> = {
  general: FileText,
  guide: BookOpen,
  safety: ShieldAlert,
  link: Link2,
};

const scopeIcon: Record<DocScope, typeof FileText> = {
  global_internal: Globe,
  project: Briefcase,
  client: Building2,
  installer_private: Lock,
};

const emptyDraft: DocDraft = {
  title: '',
  category: 'general',
  description: '',
  fileType: 'pdf',
  url: '',
  scope: 'global_internal',
  visibleToInstallers: false,
  isSensitive: false,
  projectId: null,
  clientId: null,
  ownerId: null,
};

const DocumentsManager = () => {
  const { docs, loading, createDoc, updateDoc, deleteDoc } = useDocuments();
  const [projects] = useProjects();
  const [clientRows, setClientRows] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [tab, setTab] = useState<DocScope | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DocDraft>(emptyDraft);

  useEffect(() => {
    void (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name, email').order('full_name'),
      ]);
      setClientRows((c ?? []) as { id: string; name: string }[]);
      setPeople(((p ?? []) as { id: string; full_name: string | null; email: string | null }[])
        .map(r => ({ id: r.id, name: r.full_name?.trim() || r.email || 'Unnamed user' })));
    })();
  }, []);

  const clientName = (id: string | null) => clientRows.find(c => c.id === id)?.name ?? 'Unknown customer';
  const projectName = (id: string | null) => {
    const ref = id ? projectRefForRowId(id) : undefined;
    return projects.find(p => p.id === ref)?.name ?? ref ?? 'Unknown order';
  };
  const personName = (id: string | null) => people.find(p => p.id === id)?.name ?? 'Unknown user';

  const filtered = useMemo(() => docs.filter(d => {
    if (tab !== 'all' && d.scope !== tab) return false;
    if (query && !`${d.title} ${d.description ?? ''}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [docs, tab, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length };
    (Object.keys(docScopeLabels) as DocScope[]).forEach(k => { c[k] = docs.filter(d => d.scope === k).length; });
    return c;
  }, [docs]);

  const openCreate = () => { setEditingId(null); setDraft(emptyDraft); setOpen(true); };

  const openEdit = (id: string) => {
    const doc = docs.find(d => d.id === id);
    if (!doc) return;
    setEditingId(id);
    setDraft({
      title: doc.title,
      category: doc.category,
      description: doc.description ?? '',
      url: doc.url ?? '',
      fileType: doc.fileType ?? '',
      scope: doc.scope,
      visibleToInstallers: doc.visibleToInstallers,
      isSensitive: doc.isSensitive,
      projectId: doc.projectId,
      clientId: doc.clientId,
      ownerId: doc.ownerId,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.title.trim()) { toast.error('Title is required'); return; }
    if (draft.scope === 'project' && !draft.projectId) { toast.error('Pick the order this document belongs to'); return; }
    if (draft.scope === 'client' && !draft.clientId) { toast.error('Pick the customer this document belongs to'); return; }
    if (draft.scope === 'installer_private' && !draft.ownerId) { toast.error('Pick who this private document belongs to'); return; }
    try {
      if (editingId) { await updateDoc(editingId, draft); toast.success('Document updated'); }
      else { await createDoc(draft); toast.success('Document added'); }
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message ?? 'Could not save the document');
    }
  };

  const remove = async (id: string) => {
    try { await deleteDoc(id); toast.success('Document removed'); }
    catch (e) { toast.error((e as Error).message ?? 'Could not remove the document'); }
  };

  const ownerLabel = (d: typeof docs[number]) => {
    if (d.scope === 'project') return projectName(d.projectId);
    if (d.scope === 'client') return clientName(d.clientId);
    if (d.scope === 'installer_private') return personName(d.ownerId);
    return d.visibleToInstallers ? 'Published to field staff' : 'Internal only';
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Documents & Guides</h1>
            <p className="text-sm text-muted-foreground">Every document has a purpose, and the purpose decides who can open it.</p>
          </div>
          <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add document</Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title or description…" className="pl-9" />
        </div>

        <Tabs value={tab} onValueChange={v => setTab(v as DocScope | 'all')}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            {(Object.keys(docScopeLabels) as DocScope[]).map(k => {
              const Icon = scopeIcon[k];
              return (
                <TabsTrigger key={k} value={k} className="gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {docScopeLabels[k]} ({counts[k]})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">Loading documents…</div>
            ) : filtered.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
                No documents found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(doc => {
                  const Icon = categoryIcon[doc.category] ?? FileText;
                  const ScopeIcon = scopeIcon[doc.scope];
                  const isLink = !!doc.url;
                  return (
                    <div key={doc.id} className="border border-border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm text-foreground truncate">{doc.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{doc.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <ScopeIcon className="w-3 h-3" />{docScopeLabels[doc.scope]}
                        </Badge>
                        {doc.isSensitive && <Badge variant="destructive" className="text-[10px]">Sensitive</Badge>}
                        {doc.fileType && <Badge variant="outline" className="text-[10px] uppercase">{doc.fileType}</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{ownerLabel(doc)}</p>
                      <div className="flex items-center gap-1 pt-1 border-t border-border">
                        {isLink ? (
                          <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                            <a href={doc.url ?? '#'} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Open</a>
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 text-xs" disabled><Download className="w-3.5 h-3.5" /> No file link</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => openEdit(doc.id)}>
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive ml-auto" onClick={() => remove(doc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit document' : 'Add document'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. PAX install guide" />
            </div>

            <div>
              <Label>Purpose</Label>
              <Select value={draft.scope} onValueChange={v => setDraft({ ...draft, scope: v as DocScope, projectId: null, clientId: null, ownerId: null, visibleToInstallers: false })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(docScopeLabels) as DocScope[]).map(k => (
                    <SelectItem key={k} value={k}>{docScopeLabels[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{docScopeHints[draft.scope]}</p>
            </div>

            {draft.scope === 'project' && (
              <div>
                <Label>Order</Label>
                <Select value={draft.projectId ?? ''} onValueChange={v => setDraft({ ...draft, projectId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => {
                      const rowId = projectRowId(p.id);
                      return rowId ? <SelectItem key={p.id} value={rowId}>{p.name}</SelectItem> : null;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft.scope === 'client' && (
              <div>
                <Label>Customer</Label>
                <Select value={draft.clientId ?? ''} onValueChange={v => setDraft({ ...draft, clientId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {clientRows.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft.scope === 'installer_private' && (
              <div>
                <Label>Belongs to</Label>
                <Select value={draft.ownerId ?? ''} onValueChange={v => setDraft({ ...draft, ownerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                  <SelectContent>
                    {people.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {draft.scope === 'global_internal' && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <Label className="text-sm">Publish to field staff</Label>
                  <p className="text-xs text-muted-foreground">Off means admins only.</p>
                </div>
                <Switch
                  checked={draft.visibleToInstallers}
                  disabled={draft.isSensitive}
                  onCheckedChange={v => setDraft({ ...draft, visibleToInstallers: v })}
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm">Commercially sensitive</Label>
                <p className="text-xs text-muted-foreground">Never shown to field staff.</p>
              </div>
              <Switch
                checked={draft.isSensitive}
                onCheckedChange={v => setDraft({ ...draft, isSensitive: v, visibleToInstallers: v ? false : draft.visibleToInstallers })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={draft.category} onValueChange={v => setDraft({ ...draft, category: v as DocCategory })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(docCategoryLabels) as DocCategory[]).map(k => (
                      <SelectItem key={k} value={k}>{docCategoryLabels[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>File type</Label>
                <Input value={draft.fileType ?? ''} onChange={e => setDraft({ ...draft, fileType: e.target.value })} placeholder="pdf, docx, mp4, url" />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={draft.description ?? ''} onChange={e => setDraft({ ...draft, description: e.target.value })} rows={2} />
            </div>

            <div>
              <Label>Link</Label>
              <Input value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editingId ? 'Save changes' : 'Add document'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsManager;
