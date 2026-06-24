import { useState, useMemo } from 'react';
import { FileText, BookOpen, ShieldAlert, Link2, Search, ExternalLink, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { documents, docCategoryLabels, type DocCategory } from '@/data/documentsData';

const categoryIcon: Record<DocCategory, typeof FileText> = {
  general: FileText,
  guide: BookOpen,
  safety: ShieldAlert,
  link: Link2,
};

const InstallerDocuments = () => {
  const [tab, setTab] = useState<DocCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return documents.filter(d => {
      if (tab !== 'all' && d.category !== tab) return false;
      if (query && !`${d.title} ${d.description ?? ''} ${(d.tags ?? []).join(' ')}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [tab, query]);

  return (
    <div className="p-4 space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documents…" className="pl-9" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as DocCategory | 'all')}>
        <TabsList className="w-full grid grid-cols-5 h-9">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          {(Object.keys(docCategoryLabels) as DocCategory[]).map(k => {
            const Icon = categoryIcon[k];
            return (
              <TabsTrigger key={k} value={k} className="text-xs px-1">
                <Icon className="w-3.5 h-3.5" />
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={tab} className="mt-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              No documents found.
            </div>
          ) : (
            filtered.map(doc => {
              const Icon = categoryIcon[doc.category];
              const isLink = doc.category === 'link' || !!doc.url;
              const Wrapper: any = isLink ? 'a' : 'button';
              const props = isLink
                ? { href: doc.url || '#', target: '_blank', rel: 'noreferrer' }
                : { type: 'button' };
              return (
                <Wrapper
                  key={doc.id}
                  {...props}
                  className="w-full text-left border border-border rounded-lg p-3 bg-card hover:bg-accent/40 transition-colors flex items-start gap-3 active:scale-[0.99]"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-foreground truncate">{doc.title}</h3>
                    {doc.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <Badge variant="secondary" className="text-[10px]">{docCategoryLabels[doc.category]}</Badge>
                      {doc.fileType && <Badge variant="outline" className="text-[10px] uppercase">{doc.fileType}</Badge>}
                      {doc.size && <span className="text-[10px] text-muted-foreground">{doc.size}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-muted-foreground">
                    {isLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  </div>
                </Wrapper>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InstallerDocuments;
