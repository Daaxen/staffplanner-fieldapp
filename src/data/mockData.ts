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

export interface ClientContact {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
}

export interface ClientInvoicing {
  billingName?: string;
  billingStreet?: string;
  billingPostalCode?: string;
  billingCity?: string;
  billingCountry?: string;
  vatNumber?: string;
  orgNumber?: string;
  invoiceEmail?: string;
  paymentTermsDays?: number;
  reference?: string;
}

export interface ClientRates {
  hourlyRate?: number;      // SEK / h
  overtimeRate?: number;    // SEK / h
  mileageRate?: number;     // SEK / km
  vatPercent?: number;      // %
}

export interface Client {
  id: string;              // numeric string, auto-generated
  customerNumber?: string; // free-text customer number
  name: string;
  // Office address (not tied to project locations)
  street?: string;
  postalCode?: string;
  region?: string;
  mainContact?: ClientContact;
  invoicing?: ClientInvoicing;
  rates?: ClientRates;
}

export interface Project {
  id: string;
  name: string;
  projectNumber?: string;
  projectType: ProjectType;
  clientId?: string;
  client: string;
  location: string;
  street?: string;
  postalCode?: string;
  region?: string;
  status: ProjectStatus;
  assigneeIds: string[]; // multiple assignees
  startDate: string; // ISO date
  endDate: string;   // ISO date
  startTime?: string;
  endTime?: string;
  estimatedHours?: number;
  hourlyRate?: number;   // resolved from client rates
  mileageRate?: number;  // resolved from client rates
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

// Client register — clients must exist here before orders can reference them
export const clientRegister: Client[] = [];

export const DEFAULT_CLIENT_RATES: Required<ClientRates> = {
  hourlyRate: 650,
  overtimeRate: 975,
  mileageRate: 25,
  vatPercent: 25,
};

export const ratesForClient = (clientName?: string, clientId?: string): Required<ClientRates> => {
  const c = clientRegister.find(x => (clientId && x.id === clientId) || (clientName && x.name === clientName));
  return { ...DEFAULT_CLIENT_RATES, ...(c?.rates ?? {}) };
};

// Backwards-compatible name list for autocomplete/datalists
export const clients = clientRegister.map(c => c.name);

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
export const locationDistances: Record<string, Record<string, number>> = {};

export const projects: Project[] = [];

export const statusLabels: Record<ProjectStatus, string> = {
  'open': 'Open / Unassigned',
  'scheduled': 'Scheduled',
  'in-progress': 'In Progress',
  'completed': 'Completed',
  'on-hold': 'On Hold',
  'cancelled': 'Cancelled',
};
