export type ProjectStatus = 'open' | 'scheduled' | 'in-progress' | 'confirmed' | 'completed' | 'on-hold' | 'cancelled';

export interface Installer {
  id: string;
  name: string;
  color: number; // 1-6 maps to installer-1 through installer-6
  type: 'own' | 'sub-vendor';
  avatar?: string;
  absences: Absence[];
}

export interface Absence {
  id: string;
  type: 'vacation' | 'sick' | 'personal';
  startDate: string;
  endDate: string;
  label?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  status: ProjectStatus;
  assigneeId: string | null; // null = unassigned/open
  startDate: string; // ISO date
  endDate: string;   // ISO date
  description?: string;
}

export const installers: Installer[] = [
  { id: 'inst-1', name: 'Erik Lindberg', color: 1, type: 'own', absences: [
    { id: 'abs-1', type: 'vacation', startDate: d(8), endDate: d(12), label: 'Summer vacation' },
  ] },
  { id: 'inst-2', name: 'Anna Svensson', color: 2, type: 'own', absences: [] },
  { id: 'inst-3', name: 'MontageTeam AB', color: 3, type: 'sub-vendor', absences: [] },
  { id: 'inst-4', name: 'Karl Johansson', color: 4, type: 'own', absences: [
    { id: 'abs-2', type: 'sick', startDate: d(4), endDate: d(5), label: 'Sick leave' },
  ] },
  { id: 'inst-5', name: 'Nordic Install Co', color: 5, type: 'sub-vendor', absences: [] },
  { id: 'inst-6', name: 'Sofia Bergström', color: 6, type: 'own', absences: [
    { id: 'abs-3', type: 'vacation', startDate: d(15), endDate: d(22), label: 'Vacation' },
  ] },
];

const today = new Date();
function d(offset: number) {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
}

export const projects: Project[] = [
  { id: 'proj-1', name: 'IKEA Barkarby Kitchen', client: 'IKEA', location: 'Barkarby', status: 'in-progress', assigneeId: 'inst-1', startDate: d(-2), endDate: d(3) },
  { id: 'proj-2', name: 'Elgiganten Display Wall', client: 'Elgiganten', location: 'Kista', status: 'scheduled', assigneeId: 'inst-2', startDate: d(1), endDate: d(4) },
  { id: 'proj-3', name: 'H&M Flagship Refit', client: 'H&M', location: 'Drottninggatan', status: 'confirmed', assigneeId: 'inst-3', startDate: d(-5), endDate: d(1) },
  { id: 'proj-4', name: 'Clas Ohlson Shelf System', client: 'Clas Ohlson', location: 'Kungens Kurva', status: 'on-hold', assigneeId: 'inst-4', startDate: d(2), endDate: d(8) },
  { id: 'proj-5', name: 'Stadium Sports Corner', client: 'Stadium', location: 'Mall of Scandinavia', status: 'scheduled', assigneeId: 'inst-5', startDate: d(5), endDate: d(10) },
  { id: 'proj-6', name: 'Systembolaget Renovation', client: 'Systembolaget', location: 'Södermalm', status: 'completed', assigneeId: 'inst-6', startDate: d(-10), endDate: d(-3) },
  { id: 'proj-7', name: 'Jula Workshop Install', client: 'Jula', location: 'Bromma', status: 'in-progress', assigneeId: 'inst-1', startDate: d(0), endDate: d(6) },
  { id: 'proj-8', name: 'Bauhaus Garden Center', client: 'Bauhaus', location: 'Arninge', status: 'open', assigneeId: null, startDate: d(6), endDate: d(12) },
  { id: 'proj-9', name: 'Granit Store Concept', client: 'Granit', location: 'Götgatan', status: 'cancelled', assigneeId: 'inst-3', startDate: d(3), endDate: d(7) },
  { id: 'proj-10', name: 'Kjell & Co Tech Wall', client: 'Kjell & Company', location: 'Täby', status: 'confirmed', assigneeId: 'inst-4', startDate: d(-1), endDate: d(5) },
  { id: 'proj-11', name: 'Åhléns Window Display', client: 'Åhléns', location: 'City', status: 'open', assigneeId: null, startDate: d(3), endDate: d(6) },
];

export const statusLabels: Record<ProjectStatus, string> = {
  'open': 'Open / Unassigned',
  'scheduled': 'Scheduled',
  'in-progress': 'In Progress',
  'confirmed': 'Confirmed',
  'completed': 'Completed',
  'on-hold': 'On Hold',
  'cancelled': 'Cancelled',
};
