import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  vehicles as initialVehicles, mileageEntries as initialMileage,
  serviceRecords as initialService, tireRecords as initialTires,
  type Vehicle, type MileageEntry, type ServiceRecord, type TireRecord,
  serviceTypeLabels, tireTypeLabels, fuelTypeLabels,
} from '@/data/fleetData';
import { type Project } from '@/data/mockData';
import {
  Car, Fuel, Gauge, Wrench, Plus, X, ChevronRight, Calendar,
  Ruler, Weight, Package, MapPin, CircleDot, AlertTriangle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import VehicleDetail from './VehicleDetail';

interface FleetManagerProps {
  projects: Project[];
  onAssignVehicle?: (vehicleId: string, projectId: string) => void;
}

const statusColors: Record<string, string> = {
  'available': 'bg-status-completed text-white',
  'in-use': 'bg-status-scheduled text-white',
  'service': 'bg-status-on-hold text-white',
  'out-of-service': 'bg-status-cancelled text-white',
};

const statusLabels: Record<string, string> = {
  'available': 'Available',
  'in-use': 'In Use',
  'service': 'In Service',
  'out-of-service': 'Out of Service',
};

const FleetManager = ({ projects, onAssignVehicle }: FleetManagerProps) => {
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>(initialVehicles);
  const [mileageList, setMileageList] = useState<MileageEntry[]>(initialMileage);
  const [serviceList, setServiceList] = useState<ServiceRecord[]>(initialService);
  const [tireList, setTireList] = useState<TireRecord[]>(initialTires);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredVehicles = useMemo(() => {
    if (filterStatus === 'all') return vehiclesList;
    return vehiclesList.filter(v => v.status === filterStatus);
  }, [vehiclesList, filterStatus]);

  const stats = useMemo(() => ({
    total: vehiclesList.length,
    available: vehiclesList.filter(v => v.status === 'available').length,
    inUse: vehiclesList.filter(v => v.status === 'in-use').length,
    inService: vehiclesList.filter(v => v.status === 'service').length,
  }), [vehiclesList]);

  const getAssignedProject = (v: Vehicle) => {
    if (!v.assignedProjectId) return null;
    return projects.find(p => p.id === v.assignedProjectId) || null;
  };

  const handleAddVehicle = (vehicle: Vehicle) => {
    setVehiclesList(prev => [...prev, vehicle]);
    setAddDialogOpen(false);
  };

  const handleUpdateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setVehiclesList(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    setSelectedVehicle(prev => prev?.id === id ? { ...prev, ...updates } : prev);
  };

  const handleAddMileage = (entry: MileageEntry) => {
    setMileageList(prev => [...prev, entry]);
    // Update vehicle mileage
    handleUpdateVehicle(entry.vehicleId, { currentMileageKm: entry.odometerKm });
  };

  const handleAddService = (record: ServiceRecord) => {
    setServiceList(prev => [...prev, record]);
  };

  const handleAddTire = (record: TireRecord) => {
    setTireList(prev => [...prev, record]);
    handleUpdateVehicle(record.vehicleId, { currentTires: record.toType });
  };

  const handleAssignProject = (vehicleId: string, projectId: string | undefined) => {
    handleUpdateVehicle(vehicleId, {
      assignedProjectId: projectId,
      status: projectId ? 'in-use' : 'available',
    });
    if (projectId && onAssignVehicle) onAssignVehicle(vehicleId, projectId);
  };

  const cargoVolume = (v: Vehicle) =>
    ((v.cargoLengthCm * v.cargoWidthCm * v.cargoHeightCm) / 1_000_000).toFixed(1);

  if (selectedVehicle) {
    return (
      <VehicleDetail
        vehicle={selectedVehicle}
        projects={projects}
        mileageEntries={mileageList.filter(m => m.vehicleId === selectedVehicle.id)}
        serviceRecords={serviceList.filter(s => s.vehicleId === selectedVehicle.id)}
        tireRecords={tireList.filter(t => t.vehicleId === selectedVehicle.id)}
        onBack={() => setSelectedVehicle(null)}
        onUpdateVehicle={handleUpdateVehicle}
        onAddMileage={handleAddMileage}
        onAddService={handleAddService}
        onAddTire={handleAddTire}
        onAssignProject={handleAssignProject}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Car className="w-5 h-5" /> Fleet Manager
          </h2>
          <p className="text-sm text-muted-foreground">{stats.total} vehicles · {stats.available} available</p>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Vehicle
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-muted/30 border-b border-border">
        {[
          { label: 'Total Fleet', value: stats.total, icon: Car, color: 'text-foreground' },
          { label: 'Available', value: stats.available, icon: CircleDot, color: 'text-status-completed' },
          { label: 'In Use', value: stats.inUse, icon: MapPin, color: 'text-status-scheduled' },
          { label: 'In Service', value: stats.inService, icon: Wrench, color: 'text-status-on-hold' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
            <stat.icon className={cn("w-5 h-5", stat.color)} />
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border bg-card">
        {['all', 'available', 'in-use', 'service', 'out-of-service'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              "px-3 py-1 text-xs rounded-full transition-colors capitalize",
              filterStatus === s
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {s === 'all' ? 'All' : statusLabels[s]}
          </button>
        ))}
      </div>

      {/* Vehicle list */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVehicles.map(vehicle => {
            const assignedProject = getAssignedProject(vehicle);
            const needsService = serviceList
              .filter(s => s.vehicleId === vehicle.id && s.nextServiceKm)
              .some(s => vehicle.currentMileageKm >= (s.nextServiceKm! - 1000));
            return (
              <div
                key={vehicle.id}
                onClick={() => setSelectedVehicle(vehicle)}
                className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {vehicle.make} {vehicle.model}
                    </h3>
                    <p className="text-xs text-muted-foreground">{vehicle.year} · {vehicle.licensePlate}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {needsService && (
                      <AlertTriangle className="w-4 h-4 text-status-on-hold" title="Service due soon" />
                    )}
                    <Badge variant="secondary" className={cn("text-[10px]", statusColors[vehicle.status])}>
                      {statusLabels[vehicle.status]}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" />
                    <span>{vehicle.currentMileageKm.toLocaleString()} km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5" />
                    <span>{fuelTypeLabels[vehicle.fuelType]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Weight className="w-3.5 h-3.5" />
                    <span>{vehicle.maxPayloadKg} kg</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>{cargoVolume(vehicle)} m³</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs">
                    <CircleDot className="w-3 h-3" />
                    <span className="text-muted-foreground">
                      {tireTypeLabels[vehicle.currentTires]} tires
                    </span>
                  </div>
                  {assignedProject && (
                    <span className="text-[10px] text-status-scheduled font-medium truncate max-w-[120px]">
                      📋 {assignedProject.name}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AddVehicleDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={handleAddVehicle} />
    </div>
  );
};

// Add Vehicle Dialog
function AddVehicleDialog({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; onAdd: (v: Vehicle) => void }) {
  const [form, setForm] = useState({
    make: '', model: '', year: 2024, licensePlate: '', fuelType: 'diesel' as Vehicle['fuelType'],
    maxPayloadKg: 1000, cargoLengthCm: 300, cargoWidthCm: 170, cargoHeightCm: 180, color: '',
  });

  const handleSubmit = () => {
    if (!form.make || !form.model || !form.licensePlate) return;
    onAdd({
      id: `v-${Date.now()}`,
      ...form,
      currentMileageKm: 0,
      currentTires: 'all-season',
      status: 'available',
    });
    setForm({ make: '', model: '', year: 2024, licensePlate: '', fuelType: 'diesel', maxPayloadKg: 1000, cargoLengthCm: 300, cargoWidthCm: 170, cargoHeightCm: 180, color: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Car className="w-5 h-5" /> Add Vehicle</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Make</Label>
            <Input value={form.make} onChange={e => setForm(f => ({ ...f, make: e.target.value }))} placeholder="Volkswagen" />
          </div>
          <div>
            <Label className="text-xs">Model</Label>
            <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Crafter" />
          </div>
          <div>
            <Label className="text-xs">Year</Label>
            <Input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: +e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">License Plate</Label>
            <Input value={form.licensePlate} onChange={e => setForm(f => ({ ...f, licensePlate: e.target.value }))} placeholder="ABC 123" />
          </div>
          <div>
            <Label className="text-xs">Color</Label>
            <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} placeholder="White" />
          </div>
          <div>
            <Label className="text-xs">Fuel Type</Label>
            <Select value={form.fuelType} onValueChange={v => setForm(f => ({ ...f, fuelType: v as Vehicle['fuelType'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="petrol">Petrol</SelectItem>
                <SelectItem value="electric">Electric</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 border-t border-border pt-2 mt-1">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Cargo Dimensions</p>
          </div>
          <div>
            <Label className="text-xs">Max Payload (kg)</Label>
            <Input type="number" value={form.maxPayloadKg} onChange={e => setForm(f => ({ ...f, maxPayloadKg: +e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Length (cm)</Label>
            <Input type="number" value={form.cargoLengthCm} onChange={e => setForm(f => ({ ...f, cargoLengthCm: +e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Width (cm)</Label>
            <Input type="number" value={form.cargoWidthCm} onChange={e => setForm(f => ({ ...f, cargoWidthCm: +e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Height (cm)</Label>
            <Input type="number" value={form.cargoHeightCm} onChange={e => setForm(f => ({ ...f, cargoHeightCm: +e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.make || !form.model || !form.licensePlate}>Add Vehicle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FleetManager;
