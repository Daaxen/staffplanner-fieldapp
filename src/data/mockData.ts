export type ProjectType = 'installation' | 'site-survey' | 'transport';

export type ProjectStatus = 'open' | 'scheduled' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';

export interface Installer {
  id: string;
  name: string;
  color: number; // 1-6 maps to installer-1 through installer-6
  type: 'own' | 'sub-vendor';
  avatar?: string;
  baseLocation: string; // area/city for proximity scoring
  absences: Absence[];
}

export interface Attachment {
  id: string;
  name: string;
  size: number; // bytes
  type: string; // MIME type
}

export interface Absence {
  id: string;
  type: 'vacation' | 'sick' | 'personal';
  startDate: string;
  endDate: string;
  label?: string;
}

export interface GoodsItem {
  id: string;
  description?: string;
  quantity?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
}

export interface TransportStop {
  id: string;
  type: 'pickup' | 'delivery';
  address: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  requiresSignature?: boolean;
}

export interface Project {
  id: string;
  name: string;
  projectNumber?: string;
  projectType: ProjectType;
  client: string;
  location: string;
  status: ProjectStatus;
  assigneeIds: string[]; // multiple assignees
  startDate: string; // ISO date
  endDate: string;   // ISO date
  startTime?: string;
  endTime?: string;
  estimatedHours?: number;
  isFlexOrder?: boolean;
  description?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  attachments?: Attachment[];
  installerDateOverrides?: Record<string, { startDate: string; endDate: string }>;
  // Transport-specific
  transportStops?: TransportStop[];
  vehicleType?: string;
  goodsItems?: GoodsItem[];
}

export const projectTypeLabels: Record<ProjectType, string> = {
  'installation': 'Installation',
  'site-survey': 'Site Survey',
  'transport': 'Transport',
};

export const projectTypeIcons: Record<ProjectType, string> = {
  'installation': '🔧',
  'site-survey': '📋',
  'transport': '🚛',
};

// Unique clients extracted from projects for autocomplete
export const clients = ['IKEA', 'Elgiganten', 'H&M', 'Clas Ohlson', 'Stadium', 'Systembolaget', 'Jula', 'Bauhaus', 'Granit', 'Kjell & Company', 'Åhléns'];

const today = new Date();
function d(offset: number) {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
}

export const installers: Installer[] = [
  { id: 'inst-1', name: 'Erik Lindberg', color: 1, type: 'own', baseLocation: 'Bromma', absences: [
    { id: 'abs-1', type: 'vacation', startDate: d(8), endDate: d(12), label: 'Summer vacation' },
  ] },
  { id: 'inst-2', name: 'Anna Svensson', color: 2, type: 'own', baseLocation: 'Kista', absences: [] },
  { id: 'inst-3', name: 'MontageTeam AB', color: 3, type: 'sub-vendor', baseLocation: 'Solna', absences: [] },
  { id: 'inst-4', name: 'Karl Johansson', color: 4, type: 'own', baseLocation: 'Täby', absences: [
    { id: 'abs-2', type: 'sick', startDate: d(4), endDate: d(5), label: 'Sick leave' },
  ] },
  { id: 'inst-5', name: 'Nordic Install Co', color: 5, type: 'sub-vendor', baseLocation: 'Kungens Kurva', absences: [] },
  { id: 'inst-6', name: 'Sofia Bergström', color: 6, type: 'own', baseLocation: 'Södermalm', absences: [
    { id: 'abs-3', type: 'vacation', startDate: d(15), endDate: d(22), label: 'Vacation' },
  ] },
];

// Mock distance matrix (km) between locations for proximity scoring
export const locationDistances: Record<string, Record<string, number>> = {
  'Bromma': { 'Bromma': 0, 'Kista': 8, 'Solna': 6, 'Täby': 15, 'Kungens Kurva': 12, 'Södermalm': 8, 'Barkarby': 10, 'Drottninggatan': 7, 'Hammarby': 10, 'Mall of Scandinavia': 5, 'Vasastan': 6, 'Götgatan': 8, 'Arninge': 22, 'City': 7 },
  'Kista': { 'Bromma': 8, 'Kista': 0, 'Solna': 5, 'Täby': 10, 'Kungens Kurva': 18, 'Södermalm': 12, 'Barkarby': 6, 'Drottninggatan': 10, 'Hammarby': 14, 'Mall of Scandinavia': 3, 'Vasastan': 8, 'Götgatan': 12, 'Arninge': 15, 'City': 10 },
  'Solna': { 'Bromma': 6, 'Kista': 5, 'Solna': 0, 'Täby': 12, 'Kungens Kurva': 15, 'Södermalm': 8, 'Barkarby': 8, 'Drottninggatan': 6, 'Hammarby': 10, 'Mall of Scandinavia': 2, 'Vasastan': 4, 'Götgatan': 8, 'Arninge': 18, 'City': 6 },
  'Täby': { 'Bromma': 15, 'Kista': 10, 'Solna': 12, 'Täby': 0, 'Kungens Kurva': 25, 'Södermalm': 16, 'Barkarby': 14, 'Drottninggatan': 14, 'Hammarby': 18, 'Mall of Scandinavia': 11, 'Vasastan': 12, 'Götgatan': 16, 'Arninge': 8, 'City': 14 },
  'Kungens Kurva': { 'Bromma': 12, 'Kista': 18, 'Solna': 15, 'Täby': 25, 'Kungens Kurva': 0, 'Södermalm': 10, 'Barkarby': 20, 'Drottninggatan': 12, 'Hammarby': 8, 'Mall of Scandinavia': 14, 'Vasastan': 14, 'Götgatan': 10, 'Arninge': 30, 'City': 12 },
  'Södermalm': { 'Bromma': 8, 'Kista': 12, 'Solna': 8, 'Täby': 16, 'Kungens Kurva': 10, 'Södermalm': 0, 'Barkarby': 14, 'Drottninggatan': 2, 'Hammarby': 4, 'Mall of Scandinavia': 7, 'Vasastan': 4, 'Götgatan': 1, 'Arninge': 22, 'City': 2 },
};

export const projects: Project[] = [
  { id: 'proj-1', name: 'IKEA Barkarby Kitchen', projectType: 'installation', client: 'IKEA', location: 'Barkarby', status: 'in-progress', assigneeIds: ['inst-1'], startDate: d(-2), endDate: d(3), contactName: 'Lars Eriksson', contactPhone: '+46 70 123 4567', contactEmail: 'lars.eriksson@ikea.se' },
  { id: 'proj-12', name: 'IKEA Kallax Assembly Line', projectType: 'installation', client: 'IKEA', location: 'Kungens Kurva', status: 'scheduled', assigneeIds: ['inst-2', 'inst-5'], startDate: d(4), endDate: d(9), contactName: 'Maria Holm', contactPhone: '+46 73 456 7890' },
  { id: 'proj-13', name: 'IKEA Showroom Lighting', projectType: 'site-survey', client: 'IKEA', location: 'Barkarby', status: 'open', assigneeIds: [], startDate: d(7), endDate: d(11), contactName: 'Per Nilsson', contactPhone: '+46 70 987 6543' },
  { id: 'proj-2', name: 'Elgiganten Display Wall', projectType: 'installation', client: 'Elgiganten', location: 'Kista', status: 'scheduled', assigneeIds: ['inst-2'], startDate: d(1), endDate: d(4), contactName: 'Johan Berg', contactPhone: '+46 72 111 2233', contactEmail: 'johan.berg@elgiganten.se' },
  { id: 'proj-14', name: 'Elgiganten Checkout Refit', projectType: 'installation', client: 'Elgiganten', location: 'Solna', status: 'in-progress', assigneeIds: ['inst-4', 'inst-6'], startDate: d(-1), endDate: d(2) },
  { id: 'proj-3', name: 'H&M Flagship Refit', projectType: 'installation', client: 'H&M', location: 'Drottninggatan', status: 'in-progress', assigneeIds: ['inst-3', 'inst-1'], startDate: d(-5), endDate: d(1) },
  { id: 'proj-15', name: 'H&M Storage Expansion', projectType: 'installation', client: 'H&M', location: 'Hammarby', status: 'scheduled', assigneeIds: ['inst-5'], startDate: d(3), endDate: d(8) },
  { id: 'proj-4', name: 'Clas Ohlson Shelf System', projectType: 'installation', client: 'Clas Ohlson', location: 'Kungens Kurva', status: 'on-hold', assigneeIds: ['inst-4'], startDate: d(2), endDate: d(8) },
  { id: 'proj-5', name: 'Stadium Sports Corner', projectType: 'installation', client: 'Stadium', location: 'Mall of Scandinavia', status: 'scheduled', assigneeIds: ['inst-5'], startDate: d(5), endDate: d(10) },
  { id: 'proj-6', name: 'Systembolaget Renovation', projectType: 'installation', client: 'Systembolaget', location: 'Södermalm', status: 'completed', assigneeIds: ['inst-6'], startDate: d(-10), endDate: d(-3) },
  { id: 'proj-16', name: 'Systembolaget Counter Install', projectType: 'installation', client: 'Systembolaget', location: 'Vasastan', status: 'scheduled', assigneeIds: ['inst-3'], startDate: d(2), endDate: d(6) },
  { id: 'proj-7', name: 'Jula Workshop Install', projectType: 'installation', client: 'Jula', location: 'Bromma', status: 'in-progress', assigneeIds: ['inst-1'], startDate: d(0), endDate: d(6) },
  { id: 'proj-8', name: 'Bauhaus Garden Center', projectType: 'site-survey', client: 'Bauhaus', location: 'Arninge', status: 'open', assigneeIds: [], startDate: d(6), endDate: d(12) },
  { id: 'proj-9', name: 'Granit Store Concept', projectType: 'installation', client: 'Granit', location: 'Götgatan', status: 'cancelled', assigneeIds: ['inst-3'], startDate: d(3), endDate: d(7) },
  { id: 'proj-10', name: 'Kjell & Co Tech Wall', projectType: 'installation', client: 'Kjell & Company', location: 'Täby', status: 'scheduled', assigneeIds: ['inst-4', 'inst-2'], startDate: d(-1), endDate: d(5) },
  { id: 'proj-11', name: 'Åhléns Window Display', projectType: 'transport', client: 'Åhléns', location: 'City', status: 'open', assigneeIds: [], startDate: d(3), endDate: d(6), transportStops: [
    { id: 'ts-1', type: 'pickup', address: 'Warehouse Jordbro' },
    { id: 'ts-2', type: 'delivery', address: 'Åhléns City, Klarabergsgatan 50' },
  ] },
];

export const statusLabels: Record<ProjectStatus, string> = {
  'open': 'Open / Unassigned',
  'scheduled': 'Scheduled',
  'in-progress': 'In Progress',
  'completed': 'Completed',
  'on-hold': 'On Hold',
  'cancelled': 'Cancelled',
};
