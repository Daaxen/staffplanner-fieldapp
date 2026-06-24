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

export const documents: DocItem[] = [
  {
    id: 'doc-1',
    title: 'Company Handbook 2026',
    category: 'general',
    description: 'Policies, benefits and code of conduct.',
    fileType: 'pdf',
    size: '2.4 MB',
    updatedAt: '2026-01-12',
    tags: ['policy', 'hr'],
  },
  {
    id: 'doc-2',
    title: 'Standard Service Agreement',
    category: 'general',
    description: 'Customer service agreement template.',
    fileType: 'docx',
    size: '180 KB',
    updatedAt: '2025-11-04',
  },
  {
    id: 'doc-3',
    title: 'IKEA PAX Wardrobe Install Guide',
    category: 'guide',
    description: 'Step-by-step assembly and mounting guide.',
    fileType: 'pdf',
    size: '5.1 MB',
    updatedAt: '2026-02-18',
    tags: ['IKEA', 'wardrobe'],
  },
  {
    id: 'doc-4',
    title: 'Display Wall Mounting Procedure',
    category: 'guide',
    description: 'Mounting heavy displays on drywall and concrete.',
    fileType: 'pdf',
    size: '3.2 MB',
    updatedAt: '2026-03-02',
    tags: ['display', 'mounting'],
  },
  {
    id: 'doc-5',
    title: 'Working at Heights Checklist',
    category: 'safety',
    description: 'Pre-job checklist for ladder and lift work.',
    fileType: 'pdf',
    size: '420 KB',
    updatedAt: '2026-01-28',
    tags: ['safety', 'checklist'],
  },
  {
    id: 'doc-6',
    title: 'PPE Requirements',
    category: 'safety',
    description: 'Required personal protective equipment per job type.',
    fileType: 'pdf',
    size: '1.1 MB',
    updatedAt: '2025-12-09',
  },
  {
    id: 'doc-7',
    title: 'Power Tool Safety Training',
    category: 'link',
    description: 'Internal training video (12 min).',
    fileType: 'mp4',
    url: 'https://example.com/training/power-tools',
    updatedAt: '2025-10-15',
    tags: ['training', 'video'],
  },
  {
    id: 'doc-8',
    title: 'IKEA Assembly Knowledge Base',
    category: 'link',
    description: 'External resource for product-specific guides.',
    fileType: 'url',
    url: 'https://www.ikea.com/assembly-instructions',
    updatedAt: '2025-09-21',
  },
];
