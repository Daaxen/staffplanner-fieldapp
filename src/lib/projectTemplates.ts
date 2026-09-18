import type { ProjectType } from '@/data/mockData';

/** Fields of the order form a template can make mandatory. */
export type TemplateFieldId =
  | 'name'
  | 'client'
  | 'projectNumber'
  | 'location'
  | 'startDate'
  | 'endDate'
  | 'estimatedHours'
  | 'description';

export const TEMPLATE_FIELD_LABELS: Record<TemplateFieldId, string> = {
  name: 'Project name',
  client: 'Client',
  projectNumber: 'Project number',
  location: 'Address',
  startDate: 'Start date',
  endDate: 'End date',
  estimatedHours: 'Estimated hours',
  description: 'Description',
};

export interface TemplateChecklistItem {
  id: string;
  label: string;
}

export interface TemplatePhoto {
  id: string;
  label: string;
}

export interface TemplateSignOff {
  id: string;
  label: string;
  /** Who signs: the customer on site, or the technician themselves. */
  by: 'customer' | 'installer';
}

export interface ProjectTemplate {
  id: string;
  label: string;
  icon: string;
  summary: string;
  projectType: ProjectType;
  requiredFields: TemplateFieldId[];
  checklist: TemplateChecklistItem[];
  photos: TemplatePhoto[];
  signOffs: TemplateSignOff[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'installation',
    label: 'Installation',
    icon: '🔧',
    summary: 'Standard on-site installation of new equipment or fittings.',
    projectType: 'installation',
    requiredFields: ['name', 'client', 'location', 'startDate', 'endDate', 'estimatedHours'],
    checklist: [
      { id: 'goods-checked', label: 'Goods received and checked against order' },
      { id: 'installed', label: 'Installation finished as ordered' },
      { id: 'tested', label: 'Function tested and working' },
      { id: 'cleaned', label: 'Work area cleaned and waste removed' },
      { id: 'materials', label: 'Materials and tools accounted for' },
    ],
    photos: [
      { id: 'before', label: 'Site before work' },
      { id: 'after', label: 'Finished installation' },
      { id: 'detail', label: 'Close-up of fixings / connections' },
    ],
    signOffs: [{ id: 'customer', label: 'Customer sign-off', by: 'customer' }],
  },
  {
    id: 'survey',
    label: 'Survey',
    icon: '📋',
    summary: 'Site visit to measure, photograph and document conditions.',
    projectType: 'site-survey',
    requiredFields: ['name', 'client', 'location', 'startDate'],
    checklist: [
      { id: 'measurements', label: 'Measurements taken and noted' },
      { id: 'access', label: 'Access route and delivery conditions documented' },
      { id: 'power', label: 'Power and data points checked' },
      { id: 'risks', label: 'Risks and obstacles noted' },
    ],
    photos: [
      { id: 'overview', label: 'Site overview' },
      { id: 'access-route', label: 'Access route' },
      { id: 'measure-point', label: 'Measurement points' },
    ],
    signOffs: [{ id: 'installer', label: 'Surveyor sign-off', by: 'installer' }],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: '🛠️',
    summary: 'Planned service visit on existing equipment.',
    projectType: 'installation',
    requiredFields: ['name', 'client', 'location', 'startDate', 'description'],
    checklist: [
      { id: 'inspected', label: 'Unit inspected against service plan' },
      { id: 'parts', label: 'Parts replaced and logged' },
      { id: 'tested', label: 'Function tested after service' },
      { id: 'cleaned', label: 'Area cleaned and waste removed' },
    ],
    photos: [
      { id: 'before', label: 'Condition before service' },
      { id: 'after', label: 'Condition after service' },
    ],
    signOffs: [{ id: 'customer', label: 'Customer sign-off', by: 'customer' }],
  },
  {
    id: 'repair',
    label: 'Repair',
    icon: '🧰',
    summary: 'Corrective visit for a reported fault or damage.',
    projectType: 'installation',
    requiredFields: ['name', 'client', 'location', 'startDate', 'description'],
    checklist: [
      { id: 'fault-confirmed', label: 'Reported fault confirmed on site' },
      { id: 'repaired', label: 'Repair carried out' },
      { id: 'tested', label: 'Function tested after repair' },
      { id: 'waste', label: 'Damaged parts removed / returned' },
    ],
    photos: [
      { id: 'fault', label: 'The fault or damage' },
      { id: 'repair', label: 'Repair in progress' },
      { id: 'after', label: 'Finished repair' },
    ],
    signOffs: [{ id: 'customer', label: 'Customer sign-off', by: 'customer' }],
  },
  {
    id: 'digital-signage',
    label: 'Digital Signage',
    icon: '🖥️',
    summary: 'Screens, mounts, cabling, network and content verification.',
    projectType: 'installation',
    requiredFields: ['name', 'client', 'location', 'startDate', 'endDate', 'estimatedHours'],
    checklist: [
      { id: 'mounted', label: 'Screen and mount securely fitted' },
      { id: 'power-network', label: 'Power and network connected' },
      { id: 'content', label: 'Content playing correctly' },
      { id: 'settings', label: 'Brightness, orientation and schedule set' },
      { id: 'cabling', label: 'Cabling concealed and strain relieved' },
    ],
    photos: [
      { id: 'mounting', label: 'Mount and bracket' },
      { id: 'cabling', label: 'Cable routing' },
      { id: 'playing', label: 'Screen playing content' },
      { id: 'serial', label: 'Serial number / asset label' },
    ],
    signOffs: [
      { id: 'customer', label: 'Customer sign-off', by: 'customer' },
      { id: 'installer', label: 'Technician sign-off', by: 'installer' },
    ],
  },
  {
    id: 'furniture-installation',
    label: 'Furniture Installation',
    icon: '🪑',
    summary: 'Assembly, placement and anchoring of furniture and fixtures.',
    projectType: 'installation',
    requiredFields: ['name', 'client', 'location', 'startDate', 'endDate', 'estimatedHours'],
    checklist: [
      { id: 'unpacked', label: 'Items unpacked and counted against packing list' },
      { id: 'assembled', label: 'Assembled according to drawing' },
      { id: 'anchored', label: 'Secured / anchored where required' },
      { id: 'packaging', label: 'Packaging removed from site' },
      { id: 'cleaned', label: 'Surfaces wiped and area cleaned' },
    ],
    photos: [
      { id: 'goods', label: 'Delivered goods' },
      { id: 'assembled', label: 'Assembled furniture' },
      { id: 'anchoring', label: 'Wall anchoring / fixings' },
    ],
    signOffs: [{ id: 'customer', label: 'Customer sign-off', by: 'customer' }],
  },
];

export const DEFAULT_TEMPLATE_ID = 'installation';

export const getTemplate = (id?: string | null): ProjectTemplate | undefined =>
  PROJECT_TEMPLATES.find(t => t.id === id);

/** Falls back to a template matching the order's type when none was chosen. */
export const templateForProject = (project: {
  templateId?: string;
  projectType?: ProjectType;
}): ProjectTemplate | undefined =>
  getTemplate(project.templateId) ??
  PROJECT_TEMPLATES.find(t => t.projectType === project.projectType) ??
  getTemplate(DEFAULT_TEMPLATE_ID);
