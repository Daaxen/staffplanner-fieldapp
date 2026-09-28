import { useRef, useState } from 'react';
import { ExternalLink, FileText, Paperclip, Plus, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDocUrl, uploadDoc, useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/hooks/useAuth';
import { docScopeLabels, type DocRecord } from '@/data/documentsData';
import type { DocRecord } from '@/hooks/useDocuments';
import { toast } from 'sonner';

interface Props {
  /** Order row id (uuid) the documents belong to. */
  projectId: string;
}

/** Files and links attached to one work order. What a person sees is decided
 *  by the database document rules — this list only shows what was returned. */
const OrderDocumentsSection = ({ projectId }: Props) => {
  const { docs, reload, deleteDoc } = useDocuments();
  const { isAdmin } = useAuth();
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const orderDocs = docs.filter(d => d.projectId === projectId);

  const openDoc = async (doc: DocRecord) => {
    if (doc.storagePath) {
      const url = await getDocUrl(doc.storagePath);
      if (url) window.open(url, '_blank', 'noreferrer');
      else toast.error('Could not open the file');
    } else if (doc.url) {
      window.open(doc.url, '_blank', 'noreferrer');
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDoc(file, {
        title: file.name.replace(/\.[^.]+$/, ''),
        category: 'general',
        scope: 'project',
        visibleToInstallers: false,
        isSensitive: false,
        projectId,
      });
      await reload();
      toast.success('File added to the work order');
    } catch (e) {
      toast.error((e as Error).message ?? 'Could not upload the file');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const removeDoc = async (doc: DocRecord) => {
    try {
      await deleteDoc(doc.id);
      toast.success('Document removed');
    } catch (e) {
      toast.error((e as Error).message ?? 'Could not remove the document');
    }
  };

  return (
    <section className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" /> Files &amp; docs
        </p>
        {isAdmin && (
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={e => void handleFile(e.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              <Plus className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload file'}
            </Button>
          </>
        )}
      </div>

      {orderDocs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No documents attached yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {orderDocs.map(doc => {
            const hasFile = !!doc.storagePath || !!doc.url;
            return (
              <li
                key={doc.id}
                className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-2 py-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{doc.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {docScopeLabels[doc.scope]}
                    {doc.isSensitive ? ' · sensitive' : ''}
                    {doc.fileType ? ` · ${doc.fileType}` : ''}
                  </p>
                </div>
                {doc.isSensitive && <ShieldAlert className="w-3.5 h-3.5 text-status-on-hold shrink-0" />}
                {hasFile && (
                  <button
                    onClick={() => void openDoc(doc)}
                    className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Open"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => void removeDoc(doc)}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {isAdmin && (
        <p className="text-[10px] text-muted-foreground">
          Uploaded files are visible to the people assigned to this order. Mark the document sensitive in
          Documents &amp; Guides to restrict who may open it.
        </p>
      )}
    </section>
  );
};

export default OrderDocumentsSection;
