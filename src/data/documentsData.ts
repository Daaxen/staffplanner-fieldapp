export type DocCategory = 'general' | 'guide' | 'safety' | 'link';

/** What a document is for — this, not the sandbox flag, decides who may read it. */
export type DocScope = 'global_internal' | 'project' | 'client' | 'installer_private';

export const docScopeLabels: Record<DocScope, string> = {
  global_internal: 'Global internal',
  project: 'Order document',
  client: 'Customer document',
  installer_private: 'Private (personal)',
};

export const docScopeHints: Record<DocScope, string> = {
  global_internal: 'Company-wide material. Only visible to field staff when explicitly published to them.',
  project: 'Belongs to one order. Visible to the people assigned to that order.',
  client: 'Belongs to one customer. Admins only.',
  installer_private: 'Personal document. Visible only to the person it belongs to.',
};

export interface DocItem {
  id: string;
  title: string;
  category: DocCategory;
  description?: string;
  fileType?: string; // pdf, docx, mp4, url
  size?: string;
  url?: string; // for video/link or download
  updatedAt: string; // ISO date
  tags?: string[];
}

export const docCategoryLabels: Record<DocCategory, string> = {
  general: 'General Documents',
  guide: 'Installation Guides',
  safety: 'Safety & Compliance',
  link: 'Videos & Links',
};

export const documents: DocItem[] = [];
