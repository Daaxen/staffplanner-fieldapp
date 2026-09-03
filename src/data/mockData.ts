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


export const installers: Installer[] = [];


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
