export type TireType = 'summer' | 'winter' | 'all-season';
export type ServiceType = 'oil-change' | 'inspection' | 'tire-change' | 'brake-service' | 'battery' | 'repair' | 'other';

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
export const vehicles: Vehicle[] = [
  {
    id: 'v-1', make: 'Volkswagen', model: 'Crafter', year: 2022, licensePlate: 'ABC 123',
    fuelType: 'diesel', maxPayloadKg: 1500, cargoLengthCm: 430, cargoWidthCm: 180, cargoHeightCm: 190,
    currentMileageKm: 45200, currentTires: 'winter', status: 'available', color: 'White',
  },
  {
    id: 'v-2', make: 'Ford', model: 'Transit', year: 2021, licensePlate: 'DEF 456',
    fuelType: 'diesel', maxPayloadKg: 1200, cargoLengthCm: 370, cargoWidthCm: 175, cargoHeightCm: 185,
    currentMileageKm: 67800, currentTires: 'winter', status: 'in-use', assignedProjectId: 'proj-1', color: 'Blue',
  },
  {
    id: 'v-3', make: 'Mercedes-Benz', model: 'Sprinter', year: 2023, licensePlate: 'GHI 789',
    fuelType: 'diesel', maxPayloadKg: 2000, cargoLengthCm: 470, cargoWidthCm: 185, cargoHeightCm: 195,
    currentMileageKm: 12400, currentTires: 'all-season', status: 'available', color: 'Silver',
  },
  {
    id: 'v-4', make: 'Renault', model: 'Kangoo E-Tech', year: 2024, licensePlate: 'JKL 012',
    fuelType: 'electric', maxPayloadKg: 600, cargoLengthCm: 260, cargoWidthCm: 145, cargoHeightCm: 115,
    currentMileageKm: 8300, currentTires: 'summer', status: 'service', color: 'Yellow',
  },
];

export const mileageEntries: MileageEntry[] = [
  { id: 'ml-1', vehicleId: 'v-1', date: '2026-03-01', odometerKm: 44800, tripKm: 120, driver: 'Erik Lindberg', purpose: 'IKEA Barkarby delivery' },
  { id: 'ml-2', vehicleId: 'v-1', date: '2026-03-03', odometerKm: 45050, tripKm: 250, driver: 'Erik Lindberg', purpose: 'Material pickup' },
  { id: 'ml-3', vehicleId: 'v-1', date: '2026-03-05', odometerKm: 45200, tripKm: 150, driver: 'Anna Svensson', purpose: 'Site delivery' },
  { id: 'ml-4', vehicleId: 'v-2', date: '2026-03-02', odometerKm: 67500, tripKm: 90, driver: 'Karl Johansson', purpose: 'Elgiganten install' },
  { id: 'ml-5', vehicleId: 'v-2', date: '2026-03-05', odometerKm: 67800, tripKm: 300, driver: 'Karl Johansson', purpose: 'H&M Flagship delivery' },
];

export const serviceRecords: ServiceRecord[] = [
  { id: 'sr-1', vehicleId: 'v-1', date: '2026-01-15', type: 'oil-change', description: 'Regular oil change + filter', mileageKm: 42000, cost: 2500, vendor: 'Mekonomen', nextServiceKm: 57000 },
  { id: 'sr-2', vehicleId: 'v-2', date: '2025-12-10', type: 'brake-service', description: 'Front brake pads replacement', mileageKm: 65000, cost: 4200, vendor: 'Ford Service' },
  { id: 'sr-3', vehicleId: 'v-4', date: '2026-03-04', type: 'inspection', description: 'Annual safety inspection', mileageKm: 8300, cost: 1200, vendor: 'Besikta' },
  { id: 'sr-4', vehicleId: 'v-3', date: '2026-02-20', type: 'tire-change', description: 'Winter to all-season tires', mileageKm: 12000, cost: 3800, vendor: 'Däckia' },
];

export const tireRecords: TireRecord[] = [
  { id: 'tr-1', vehicleId: 'v-3', date: '2026-02-20', fromType: 'winter', toType: 'all-season', mileageKm: 12000, treadDepthMm: 5.2 },
  { id: 'tr-2', vehicleId: 'v-1', date: '2025-11-01', fromType: 'summer', toType: 'winter', mileageKm: 40000, treadDepthMm: 7.1 },
];
