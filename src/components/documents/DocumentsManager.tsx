import { useState, useMemo } from 'react';
import { FileText, BookOpen, ShieldAlert, Link2, Plus, Search, Upload, Trash2, Download, ExternalLink, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { documents as seed, docCategoryLabels, type DocItem, type DocCategory } from '@/data/documentsData';
import { toast } from 'sonner';

const categoryIcon: Record<DocCategory, typeof FileText> = {
  general: FileText,
  guide: BookOpen,
  safety: ShieldAlert,
  link: Link2,
};

const emptyDraft: Omit<DocItem, 'id' | 'updatedAt'> = {
  title: '',
  category: 'general',
  description: '',
  fileType: 'pdf',
  url: '',
};

const DocumentsManager = () => {
  const [docs, setDocs] = useState<DocItem[]>(seed);
  const [tab, setTab] = useState<DocCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DocItem | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (tab !== 'all' && d.category !== tab) return false;
      if (query && !`${d.title} ${d.description ?? ''} ${(d.tags ?? []).join(' ')}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [docs, tab, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length };
    (Object.keys(docCategoryLabels) as DocCategory[]).forEach(k => {
      c[k] = docs.filter(d => d.category === k).length;
    });
    return c;
  }, [docs]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft);
    setOpen(true);
  };

  const openEdit = (doc: DocItem) => {
    setEditing(doc);
    setDraft({
      title: doc.title,
      category: doc.category,
      description: doc.description ?? '',
      fileType: doc.fileType,
      url: doc.url,
    });
    setOpen(true);
  };

  const save = () => {
    if (!draft.title.trim()) {
      toast.error('Title is required');
      return;
    }
    const now = new Date().toISOString().split('T')[0];
    if (editing) {
      setDocs(prev => prev.map(d => d.id === editing.id ? { ...d, ...draft, updatedAt: now } : d));
      toast.success('Document updated');
    } else {
      setDocs(prev => [
        { id: `doc-${Date.now()}`, ...draft, updatedAt: now, size: draft.url ? undefined : '— KB' },
        ...prev,
      ]);
      toast.success('Document added');
    }
    setOpen(false);
  };

  const remove = (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id));
    toast.success('Document removed');
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Documents & Guides</h1>
            <p className="text-sm text-muted-foreground">Manage company documents, install guides, safety material and links.</p>
          </div>
          <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add document</Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, tag, description…" className="pl-9" />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as DocCategory | 'all')}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            {(Object.keys(docCategoryLabels) as DocCategory[]).map(k => {
              const Icon = categoryIcon[k];
              return (
                <TabsTrigger key={k} value={k} className="gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {docCategoryLabels[k]} ({counts[k]})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {filtered.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
                No documents found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map(doc => {
                  const Icon = categoryIcon[doc.category];
                  const isLink = doc.category === 'link' || !!doc.url;
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
                        <Badge variant="secondary" className="text-[10px]">{docCategoryLabels[doc.category]}</Badge>
                        {doc.fileType && <Badge variant="outline" className="text-[10px] uppercase">{doc.fileType}</Badge>}
                        {doc.size && <span className="text-[10px] text-muted-foreground">{doc.size}</span>}
                        <span className="text-[10px] text-muted-foreground ml-auto">Updated {doc.updatedAt}</span>
                      </div>
                      <div className="flex items-center gap-1 pt-1 border-t border-border">
                        {isLink ? (
                          <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                            <a href={doc.url || '#'} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /> Open</a>
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 text-xs"><Download className="w-3.5 h-3.5" /> Download</Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => openEdit(doc)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit document' : 'Add document'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. IKEA PAX Install Guide" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as DocCategory })}>
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
              <Label>{draft.category === 'link' ? 'URL' : 'URL (optional)'}</Label>
              <Input value={draft.url ?? ''} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
            </div>
            {draft.category !== 'link' && (
              <div className="border border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <Upload className="w-5 h-5" />
                Drop file here or click to upload (mock)
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Save changes' : 'Add document'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsManager;
