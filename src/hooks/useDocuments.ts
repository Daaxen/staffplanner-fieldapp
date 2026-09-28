import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DocCategory, DocScope } from '@/data/documentsData';

export interface DocRecord {
  id: string;
  title: string;
  category: DocCategory;
  description: string | null;
  url: string | null;
  fileType: string | null;
  scope: DocScope;
  visibleToInstallers: boolean;
  isSensitive: boolean;
  projectId: string | null;
  clientId: string | null;
  ownerId: string | null;
  storagePath: string | null;
  updatedAt: string;
}

export interface DocDraft {
  title: string;
  category: DocCategory;
  description?: string;
  url?: string;
  fileType?: string;
  scope: DocScope;
  visibleToInstallers: boolean;
  isSensitive: boolean;
  projectId?: string | null;
  clientId?: string | null;
  ownerId?: string | null;
  /** Set when the document is backed by an uploaded file in the documents bucket. */
  storagePath?: string | null;
}

type Row = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  url: string | null;
  file_type: string | null;
  scope: string;
  visible_to_installers: boolean;
  is_sensitive: boolean;
  project_id: string | null;
  client_id: string | null;
  owner_id: string | null;
  storage_path: string | null;
  updated_at: string;
};

const toRecord = (r: Row): DocRecord => ({
  id: r.id,
  title: r.title,
  category: r.category as DocCategory,
  description: r.description,
  url: r.url,
  fileType: r.file_type,
  scope: r.scope as DocScope,
  visibleToInstallers: r.visible_to_installers,
  isSensitive: r.is_sensitive,
  projectId: r.project_id,
  clientId: r.client_id,
  ownerId: r.owner_id,
  storagePath: r.storage_path,
  updatedAt: r.updated_at,
});

const DOC_COLUMNS = 'id, title, category, description, url, file_type, scope, visible_to_installers, is_sensitive, project_id, client_id, owner_id, storage_path, updated_at';

/** Ownership fields are normalised to match the document purpose, mirroring
 *  the database check constraints so invalid combinations never leave the app. */
const toRow = (d: DocDraft) => ({
  title: d.title.trim(),
  category: d.category,
  description: d.description?.trim() || null,
  url: d.url?.trim() || null,
  file_type: d.fileType?.trim() || null,
  scope: d.scope,
  visible_to_installers: d.scope === 'global_internal' ? d.visibleToInstallers && !d.isSensitive : false,
  is_sensitive: d.scope === 'project_sensitive' ? true : d.isSensitive,
  project_id: d.scope === 'project' || d.scope === 'project_sensitive' ? d.projectId ?? null : null,
  client_id: d.scope === 'client' ? d.clientId ?? null : null,
  owner_id: d.scope === 'installer_private' ? d.ownerId ?? null : null,
  storage_path: d.storagePath ?? null,
});

export interface DocGrant {
  id: string;
  profileId: string;
  reason: string;
  createdAt: string;
}

/** Explicit, reasoned access grants for sensitive order documents. */
export const listDocGrants = async (documentId: string): Promise<DocGrant[]> => {
  const { data, error } = await supabase
    .from('document_access')
    .select('id, profile_id, reason, created_at')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({
    id: r.id as string,
    profileId: r.profile_id as string,
    reason: r.reason as string,
    createdAt: r.created_at as string,
  }));
};

export const grantDocAccess = async (documentId: string, profileId: string, reason: string) => {
  const { error } = await supabase
    .from('document_access')
    .insert({ document_id: documentId, profile_id: profileId, reason: reason.trim() });
  if (error) throw error;
};

export const revokeDocAccess = async (grantId: string) => {
  const { error } = await supabase.from('document_access').delete().eq('id', grantId);
  if (error) throw error;
};

export const MAX_DOC_FILE_SIZE = 25 * 1024 * 1024; // 25 MB — same as the bucket limit

const extensionOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

/** Uploads a real file into the private documents bucket and saves the document
 *  row in one go. The uploaded file is removed again if saving the row fails. */
export const uploadDoc = async (file: File, draft: Omit<DocDraft, 'fileType' | 'url' | 'storagePath'>) => {
  if (file.size > MAX_DOC_FILE_SIZE) throw new Error('The file is larger than 25 MB');
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sign in to upload files');
  const docId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\-() åäöÅÄÖ]/g, '_');
  const path = `${userId}/${docId}/${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) throw uploadError;
  const row = toRow({
    ...draft,
    url: undefined,
    fileType: extensionOf(file.name) || 'file',
    storagePath: path,
  });
  const { error } = await supabase.from('documents').insert(row);
  if (error) {
    await supabase.storage.from('documents').remove([path]);
    throw error;
  }
};

/** Short-lived link to an uploaded file; the storage rules check who may open it. */
export const getDocUrl = async (storagePath: string): Promise<string | null> => {
  const { data } = await supabase.storage.from('documents').createSignedUrl(storagePath, 600);
  return data?.signedUrl ?? null;
};

/** Loads the documents the signed-in user is allowed to see. Access is decided
 *  in the database by document purpose, never by any client-side filter. */
export const useDocuments = () => {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select(DOC_COLUMNS)
      .order('updated_at', { ascending: false });
    if (!error) setDocs(((data ?? []) as Row[]).map(toRecord));
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const createDoc = useCallback(async (draft: DocDraft) => {
    const { error } = await supabase.from('documents').insert(toRow(draft));
    if (error) throw error;
    await reload();
  }, [reload]);

  const updateDoc = useCallback(async (id: string, draft: DocDraft) => {
    const { error } = await supabase.from('documents').update(toRow(draft)).eq('id', id);
    if (error) throw error;
    await reload();
  }, [reload]);

  const deleteDoc = useCallback(async (id: string) => {
    const doc = docs.find(d => d.id === id);
    if (doc?.storagePath) {
      const { error: storageError } = await supabase.storage.from('documents').remove([doc.storagePath]);
      // The row is still removed even when the stored file is already gone.
      if (storageError) console.warn('Could not remove the stored file', storageError.message);
    }
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
    await reload();
  }, [docs, reload]);

  return { docs, loading, reload, createDoc, updateDoc, deleteDoc };
};
