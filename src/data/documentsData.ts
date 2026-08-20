export type DocCategory = 'general' | 'guide' | 'safety' | 'link';

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
