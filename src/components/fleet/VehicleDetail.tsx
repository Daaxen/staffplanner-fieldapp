import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  type Vehicle, type MileageEntry, type ServiceRecord, type TireRecord,
  type ServiceType, type TireType,
  serviceTypeLabels, tireTypeLabels, fuelTypeLabels,
} from '@/data/fleetData';
import { type Project } from '@/data/mockData';
import {
  ArrowLeft, Gauge, Fuel, Weight, Package, CircleDot, Plus,
  Calendar, Wrench, Car, MapPin, Ruler,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VehicleDetailProps {
  vehicle: Vehicle;
  projects: Project[];
  mileageEntries: MileageEntry[];
  serviceRecords: ServiceRecord[];
  tireRecords: TireRecord[];
  onBack: () => void;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  onAddMileage: (entry: MileageEntry) => void;
  onAddService: (record: ServiceRecord) => void;
  onAddTire: (record: TireRecord) => void;
  onAssignProject: (vehicleId: string, projectId: string | undefined) => void;
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

const VehicleDetail = ({
  vehicle, projects, mileageEntries, serviceRecords, tireRecords,
  onBack, onUpdateVehicle, onAddMileage, onAddService, onAddTire, onAssignProject,
}: VehicleDetailProps) => {
  const [addMileageOpen, setAddMileageOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addTireOpen, setAddTireOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const cargoVolume = ((vehicle.cargoLengthCm * vehicle.cargoWidthCm * vehicle.cargoHeightCm) / 1_000_000).toFixed(1);
  const assignedProject = vehicle.assignedProjectId ? projects.find(p => p.id === vehicle.assignedProjectId) : null;

  const availableProjects = projects.filter(p =>
    ['open', 'scheduled', 'in-progress'].includes(p.status)
  );

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Car className="w-5 h-5" />
            {vehicle.make} {vehicle.model}
            <span className="text-muted-foreground font-normal text-sm">· {vehicle.licensePlate}</span>
          </h2>
          <p className="text-sm text-muted-foreground">{vehicle.year} · {vehicle.color} · {fuelTypeLabels[vehicle.fuelType]}</p>
        </div>
        <Badge className={cn("text-xs", statusColors[vehicle.status])}>
          {statusLabels[vehicle.status]}
        </Badge>
        <Select
          value={vehicle.status}
          onValueChange={(v) => onUpdateVehicle(vehicle.id, { status: v as Vehicle['status'] })}
        >
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="in-use">In Use</SelectItem>
            <SelectItem value="service">In Service</SelectItem>
            <SelectItem value="out-of-service">Out of Service</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-5 gap-3 px-6 py-4 bg-muted/30 border-b border-border">
        <InfoCard icon={Gauge} label="Mileage" value={`${vehicle.currentMileageKm.toLocaleString()} km`} />
        <InfoCard icon={Weight} label="Payload" value={`${vehicle.maxPayloadKg} kg`} />
        <InfoCard icon={Package} label="Cargo Volume" value={`${cargoVolume} m³`} />
        <InfoCard icon={Ruler} label="Cargo (L×W×H)" value={`${vehicle.cargoLengthCm}×${vehicle.cargoWidthCm}×${vehicle.cargoHeightCm} cm`} />
        <InfoCard icon={CircleDot} label="Tires" value={tireTypeLabels[vehicle.currentTires]} />
      </div>

      {/* Project assignment */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-card">
        <MapPin className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Assigned to:</span>
        {assignedProject ? (
          <span className="text-sm font-medium text-foreground">{assignedProject.name}</span>
        ) : (
          <span className="text-sm text-muted-foreground/60 italic">No project assigned</span>
        )}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            {assignedProject ? 'Change Project' : 'Assign to Project'}
          </Button>
          {assignedProject && (
            <Button size="sm" variant="ghost" onClick={() => onAssignProject(vehicle.id, undefined)}>
              Unassign
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mileage" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="mileage">Mileage ({mileageEntries.length})</TabsTrigger>
          <TabsTrigger value="service">Service & Maintenance ({serviceRecords.length})</TabsTrigger>
          <TabsTrigger value="tires">Tires ({tireRecords.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mileage" className="flex-1 overflow-auto px-6 pb-6">
          <div className="flex justify-between items-center mb-3 mt-2">
            <h3 className="text-sm font-semibold text-foreground">Mileage Log</h3>
            <Button size="sm" variant="outline" onClick={() => setAddMileageOpen(true)}>
              <Plus className="w-3 h-3 mr-1" /> Log Trip
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="text-left py-2 px-2">Date</th>
                <th className="text-right py-2 px-2">Odometer</th>
                <th className="text-right py-2 px-2">Trip</th>
                <th className="text-left py-2 px-2">Driver</th>
                <th className="text-left py-2 px-2">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[...mileageEntries].sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-2">{entry.date}</td>
                  <td className="py-2 px-2 text-right font-medium">{entry.odometerKm.toLocaleString()} km</td>
                  <td className="py-2 px-2 text-right text-muted-foreground">{entry.tripKm ? `${entry.tripKm} km` : '—'}</td>
                  <td className="py-2 px-2 text-muted-foreground">{entry.driver || '—'}</td>
                  <td className="py-2 px-2 text-muted-foreground">{entry.purpose || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="service" className="flex-1 overflow-auto px-6 pb-6">
          <div className="flex justify-between items-center mb-3 mt-2">
            <h3 className="text-sm font-semibold text-foreground">Service & Repairs</h3>
            <Button size="sm" variant="outline" onClick={() => setAddServiceOpen(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add Record
            </Button>
          </div>
          <div className="space-y-3">
            {[...serviceRecords].sort((a, b) => b.date.localeCompare(a.date)).map(record => (
              <div key={record.id} className="p-3 bg-muted/20 rounded-lg border border-border">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{serviceTypeLabels[record.type]}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{record.date}</span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">{record.description}</p>
                <div className="flex items-center gap-4 mt-2 ml-6 text-xs text-muted-foreground">
                  <span>{record.mileageKm.toLocaleString()} km</span>
                  {record.cost && <span className="font-medium text-foreground">{record.cost.toLocaleString()} SEK</span>}
                  {record.vendor && <span>@ {record.vendor}</span>}
                  {record.nextServiceKm && (
                    <span className="text-status-on-hold">Next: {record.nextServiceKm.toLocaleString()} km</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tires" className="flex-1 overflow-auto px-6 pb-6">
          <div className="flex justify-between items-center mb-3 mt-2">
            <h3 className="text-sm font-semibold text-foreground">Tire Changes</h3>
            <Button size="sm" variant="outline" onClick={() => setAddTireOpen(true)}>
              <Plus className="w-3 h-3 mr-1" /> Log Change
            </Button>
          </div>
          <div className="space-y-3">
            {[...tireRecords].sort((a, b) => b.date.localeCompare(a.date)).map(record => (
              <div key={record.id} className="p-3 bg-muted/20 rounded-lg border border-border flex items-center gap-4">
                <CircleDot className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {tireTypeLabels[record.fromType]} → {tireTypeLabels[record.toType]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {record.date} · {record.mileageKm.toLocaleString()} km
                    {record.treadDepthMm && ` · Tread: ${record.treadDepthMm}mm`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddMileageDialog open={addMileageOpen} onOpenChange={setAddMileageOpen} vehicleId={vehicle.id} currentKm={vehicle.currentMileageKm} onAdd={onAddMileage} />
      <AddServiceDialog open={addServiceOpen} onOpenChange={setAddServiceOpen} vehicleId={vehicle.id} currentKm={vehicle.currentMileageKm} onAdd={onAddService} />
      <AddTireDialog open={addTireOpen} onOpenChange={setAddTireOpen} vehicleId={vehicle.id} currentKm={vehicle.currentMileageKm} currentTires={vehicle.currentTires} onAdd={onAddTire} />
      <AssignProjectDialog open={assignOpen} onOpenChange={setAssignOpen} projects={availableProjects} onAssign={(pid) => { onAssignProject(vehicle.id, pid); setAssignOpen(false); }} />
    </div>
  );
};

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border border-border">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function AddMileageDialog({ open, onOpenChange, vehicleId, currentKm, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void; vehicleId: string; currentKm: number; onAdd: (e: MileageEntry) => void;
}) {
  const [form, setForm] = useState({ odometerKm: currentKm, tripKm: 0, driver: '', purpose: '', date: new Date().toISOString().split('T')[0] });
  const handleSubmit = () => {
    onAdd({ id: `ml-${Date.now()}`, vehicleId, ...form });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Mileage</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div><Label className="text-xs">Odometer (km)</Label><Input type="number" value={form.odometerKm} onChange={e => setForm(f => ({ ...f, odometerKm: +e.target.value }))} /></div>
          <div><Label className="text-xs">Trip Distance (km)</Label><Input type="number" value={form.tripKm} onChange={e => setForm(f => ({ ...f, tripKm: +e.target.value }))} /></div>
          <div><Label className="text-xs">Driver</Label><Input value={form.driver} onChange={e => setForm(f => ({ ...f, driver: e.target.value }))} /></div>
          <div className="col-span-2"><Label className="text-xs">Purpose</Label><Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddServiceDialog({ open, onOpenChange, vehicleId, currentKm, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void; vehicleId: string; currentKm: number; onAdd: (r: ServiceRecord) => void;
}) {
  const [form, setForm] = useState({ type: 'oil-change' as ServiceType, description: '', cost: 0, vendor: '', date: new Date().toISOString().split('T')[0], nextServiceKm: 0 });
  const handleSubmit = () => {
    onAdd({ id: `sr-${Date.now()}`, vehicleId, mileageKm: currentKm, ...form, nextServiceKm: form.nextServiceKm || undefined });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Service Record</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as ServiceType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(serviceTypeLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><Label className="text-xs">Cost (SEK)</Label><Input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: +e.target.value }))} /></div>
          <div><Label className="text-xs">Vendor</Label><Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} /></div>
          <div><Label className="text-xs">Next Service (km)</Label><Input type="number" value={form.nextServiceKm} onChange={e => setForm(f => ({ ...f, nextServiceKm: +e.target.value }))} placeholder="Optional" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddTireDialog({ open, onOpenChange, vehicleId, currentKm, currentTires, onAdd }: {
  open: boolean; onOpenChange: (o: boolean) => void; vehicleId: string; currentKm: number; currentTires: TireType; onAdd: (r: TireRecord) => void;
}) {
  const [form, setForm] = useState({ toType: (currentTires === 'winter' ? 'summer' : 'winter') as TireType, treadDepthMm: 0, notes: '', date: new Date().toISOString().split('T')[0] });
  const handleSubmit = () => {
    onAdd({ id: `tr-${Date.now()}`, vehicleId, fromType: currentTires, mileageKm: currentKm, ...form, treadDepthMm: form.treadDepthMm || undefined });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Tire Change</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
          <div>
            <Label className="text-xs">New Tire Type</Label>
            <Select value={form.toType} onValueChange={v => setForm(f => ({ ...f, toType: v as TireType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(tireTypeLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Tread Depth (mm)</Label><Input type="number" step="0.1" value={form.treadDepthMm} onChange={e => setForm(f => ({ ...f, treadDepthMm: +e.target.value }))} /></div>
          <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignProjectDialog({ open, onOpenChange, projects, onAssign }: {
  open: boolean; onOpenChange: (o: boolean) => void; projects: Project[]; onAssign: (projectId: string) => void;
}) {
  const [selected, setSelected] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign to Project</DialogTitle></DialogHeader>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name} — {p.client}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => selected && onAssign(selected)} disabled={!selected}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VehicleDetail;
