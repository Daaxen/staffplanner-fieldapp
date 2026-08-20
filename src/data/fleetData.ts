export type TireType = 'summer' | 'winter' | 'all-season';
export type ServiceType = 'oil-change' | 'inspection' | 'tire-change' | 'brake-service' | 'battery' | 'repair' | 'other';
export type InspectionStatus = 'pending' | 'overdue' | 'completed' | 'escalated';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  color?: string;
  fuelType: 'diesel' | 'petrol' | 'electric' | 'hybrid';
  // Capacity & dimensions
  maxPayloadKg: number;
  cargoLengthCm: number;
  cargoWidthCm: number;
  cargoHeightCm: number;
  // Status
  currentMileageKm: number;
  currentTires: TireType;
  status: 'available' | 'in-use' | 'service' | 'out-of-service';
  assignedProjectId?: string;
  notes?: string;
  imageUrl?: string;
}

export interface MileageEntry {
  id: string;
  vehicleId: string;
  date: string;
  odometerKm: number;
  tripKm?: number;
  driver?: string;
  purpose?: string;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  date: string;
  type: ServiceType;
  description: string;
  mileageKm: number;
  cost?: number;
  vendor?: string;
  nextServiceKm?: number;
  nextServiceDate?: string;
}

export interface TireRecord {
  id: string;
  vehicleId: string;
  date: string;
  fromType: TireType;
  toType: TireType;
  mileageKm: number;
  treadDepthMm?: number;
  notes?: string;
}

export const serviceTypeLabels: Record<ServiceType, string> = {
  'oil-change': 'Oil Change',
  'inspection': 'Inspection',
  'tire-change': 'Tire Change',
  'brake-service': 'Brake Service',
  'battery': 'Battery',
  'repair': 'Repair',
  'other': 'Other',
};

export interface InspectionChecklistItem {
  id: string;
  label: string;
  category: 'exterior' | 'interior' | 'mechanical' | 'safety' | 'fluids' | 'cargo';
  /** Fuel types this item does NOT apply to */
  excludeFuelTypes?: Vehicle['fuelType'][];
}

export interface InspectionRecord {
  id: string;
  vehicleId: string;
  dueDate: string;
  completedDate?: string;
  status: InspectionStatus;
  driver: string;
  checklist: { itemId: string; checked: boolean; note?: string }[];
  reminderCount: number;
  escalatedToManager: boolean;
  escalatedDate?: string;
}

export const inspectionChecklist: InspectionChecklistItem[] = [
  // Exterior
  { id: 'ext-1', label: 'Body damage / new scratches', category: 'exterior' },
  { id: 'ext-2', label: 'Lights working (headlights, brake, indicators)', category: 'exterior' },
  { id: 'ext-3', label: 'Windshield condition (chips/cracks)', category: 'exterior' },
  { id: 'ext-4', label: 'Wipers functional', category: 'exterior' },
  { id: 'ext-5', label: 'Tire condition & pressure', category: 'exterior' },
  { id: 'ext-6', label: 'License plates visible & clean', category: 'exterior' },
  // Interior
  { id: 'int-1', label: 'Cabin cleanliness', category: 'interior' },
  { id: 'int-2', label: 'Seatbelts working', category: 'interior' },
  { id: 'int-3', label: 'Dashboard warning lights (none active)', category: 'interior' },
  { id: 'int-4', label: 'Horn working', category: 'interior' },
  { id: 'int-5', label: 'Mirrors adjusted & intact', category: 'interior' },
  // Mechanical
  { id: 'mech-1', label: 'Brakes responsive (no unusual sounds)', category: 'mechanical' },
  { id: 'mech-2', label: 'Steering smooth (no play)', category: 'mechanical' },
  { id: 'mech-3', label: 'No unusual engine noises', category: 'mechanical', excludeFuelTypes: ['electric'] },
  { id: 'mech-4', label: 'Exhaust — no excessive smoke', category: 'mechanical', excludeFuelTypes: ['electric'] },
  // Safety
  { id: 'safe-1', label: 'First aid kit present', category: 'safety' },
  { id: 'safe-2', label: 'Warning triangle present', category: 'safety' },
  { id: 'safe-3', label: 'Fire extinguisher present & valid', category: 'safety' },
  { id: 'safe-4', label: 'Reflective vest in cabin', category: 'safety' },
  // Fluids
  { id: 'flu-1', label: 'Engine oil level OK', category: 'fluids', excludeFuelTypes: ['electric'] },
  { id: 'flu-2', label: 'Coolant level OK', category: 'fluids' },
  { id: 'flu-3', label: 'Washer fluid level OK', category: 'fluids' },
  { id: 'flu-4', label: 'Fuel / charge level sufficient', category: 'fluids' },
  // Cargo Equipment
  { id: 'cargo-1', label: 'Cargo straps / tie-downs present & intact', category: 'cargo' },
  { id: 'cargo-2', label: 'Loading ramp / lift functional', category: 'cargo' },
  { id: 'cargo-3', label: 'Cargo area clean & free of debris', category: 'cargo' },
  { id: 'cargo-4', label: 'Cargo doors / locks working properly', category: 'cargo' },
  { id: 'cargo-5', label: 'Protective blankets / padding available', category: 'cargo' },
  { id: 'cargo-6', label: 'Toolbox / mounting hardware stocked', category: 'cargo' },
];

export const inspectionCategoryLabels: Record<string, string> = {
  exterior: 'Exterior',
  interior: 'Interior',
  mechanical: 'Mechanical',
  safety: 'Safety Equipment',
  fluids: 'Fluids & Levels',
  cargo: 'Cargo Equipment',
};

/** Returns the checklist items applicable to a given fuel type */
export function getChecklistForVehicle(fuelType: Vehicle['fuelType']): InspectionChecklistItem[] {
  return inspectionChecklist.filter(
    item => !item.excludeFuelTypes?.includes(fuelType)
  );
}

export const tireTypeLabels: Record<TireType, string> = {
  'summer': 'Summer',
  'winter': 'Winter',
  'all-season': 'All-Season',
};

export const fuelTypeLabels: Record<string, string> = {
  'diesel': 'Diesel',
  'petrol': 'Petrol',
  'electric': 'Electric',
  'hybrid': 'Hybrid',
};

// Mock data
export const vehicles: Vehicle[] = [];

export const mileageEntries: MileageEntry[] = [];

export const serviceRecords: ServiceRecord[] = [];

export const tireRecords: TireRecord[] = [];

// Monthly inspection interval in days
export const INSPECTION_INTERVAL_DAYS = 30;
export const ESCALATION_AFTER_REMINDERS = 3;

export const inspectionRecords: InspectionRecord[] = [];
