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
  updatedAt: r.updated_at,
});

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
  is_sensitive: d.isSensitive,
  project_id: d.scope === 'project' ? d.projectId ?? null : null,
  client_id: d.scope === 'client' ? d.clientId ?? null : null,
  owner_id: d.scope === 'installer_private' ? d.ownerId ?? null : null,
});

/** Loads the documents the signed-in user is allowed to see. Access is decided
 *  in the database by document purpose, never by any client-side filter. */
export const useDocuments = () => {
  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, category, description, url, file_type, scope, visible_to_installers, is_sensitive, project_id, client_id, owner_id, updated_at')
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
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
    await reload();
  }, [reload]);

  return { docs, loading, reload, createDoc, updateDoc, deleteDoc };
};
