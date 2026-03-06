import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  type Vehicle, type MileageEntry, type ServiceRecord, type TireRecord,
  type ServiceType, type TireType, type InspectionRecord, type InspectionChecklistItem,
  serviceTypeLabels, tireTypeLabels, fuelTypeLabels,
  inspectionChecklist, inspectionCategoryLabels, getChecklistForVehicle,
  INSPECTION_INTERVAL_DAYS, ESCALATION_AFTER_REMINDERS,
} from '@/data/fleetData';
import { type Project } from '@/data/mockData';
import {
  ArrowLeft, Gauge, Fuel, Weight, Package, CircleDot, Plus,
  Calendar, Wrench, Car, MapPin, Ruler, ClipboardCheck, AlertTriangle,
  Bell, ShieldAlert, CheckCircle2, Clock, Send, Settings2, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface VehicleDetailProps {
  vehicle: Vehicle;
  projects: Project[];
  mileageEntries: MileageEntry[];
  serviceRecords: ServiceRecord[];
  tireRecords: TireRecord[];
  inspectionRecords: InspectionRecord[];
  onBack: () => void;
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  onAddMileage: (entry: MileageEntry) => void;
  onAddService: (record: ServiceRecord) => void;
  onAddTire: (record: TireRecord) => void;
  onAssignProject: (vehicleId: string, projectId: string | undefined) => void;
  onUpdateInspection: (id: string, updates: Partial<InspectionRecord>) => void;
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

const inspectionStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  'pending': { label: 'Pending', color: 'bg-status-scheduled text-white', icon: Clock },
  'overdue': { label: 'Overdue', color: 'bg-status-on-hold text-white', icon: AlertTriangle },
  'completed': { label: 'Completed', color: 'bg-status-completed text-white', icon: CheckCircle2 },
  'escalated': { label: 'Escalated to Manager', color: 'bg-status-cancelled text-white', icon: ShieldAlert },
};

const VehicleDetail = ({
  vehicle, projects, mileageEntries, serviceRecords, tireRecords, inspectionRecords,
  onBack, onUpdateVehicle, onAddMileage, onAddService, onAddTire, onAssignProject, onUpdateInspection,
}: VehicleDetailProps) => {
  const [addMileageOpen, setAddMileageOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addTireOpen, setAddTireOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [activeInspection, setActiveInspection] = useState<InspectionRecord | null>(null);
  const [showChecklistConfig, setShowChecklistConfig] = useState(false);
  const [customExclusions, setCustomExclusions] = useState<string[]>([]);

  const cargoVolume = ((vehicle.cargoLengthCm * vehicle.cargoWidthCm * vehicle.cargoHeightCm) / 1_000_000).toFixed(1);
  const assignedProject = vehicle.assignedProjectId ? projects.find(p => p.id === vehicle.assignedProjectId) : null;
  const availableProjects = projects.filter(p => ['open', 'scheduled', 'in-progress'].includes(p.status));

  // Get checklist filtered by fuel type, then also remove custom exclusions
  const fuelFilteredChecklist = getChecklistForVehicle(vehicle.fuelType);
  const activeChecklist = fuelFilteredChecklist.filter(item => !customExclusions.includes(item.id));

  const overdueInspections = inspectionRecords.filter(i => i.status === 'overdue' || i.status === 'escalated');

  const handleSendReminder = (inspection: InspectionRecord) => {
    const newCount = inspection.reminderCount + 1;
    const shouldEscalate = newCount >= ESCALATION_AFTER_REMINDERS;
    
    onUpdateInspection(inspection.id, {
      reminderCount: newCount,
      ...(shouldEscalate ? {
        status: 'escalated' as const,
        escalatedToManager: true,
        escalatedDate: new Date().toISOString().split('T')[0],
      } : {}),
    });

    if (shouldEscalate) {
      toast.error(`⚠️ Escalated to manager — ${inspection.driver} has ignored ${newCount} reminders for vehicle inspection.`, { duration: 6000 });
    } else {
      toast.warning(`📨 Reminder #${newCount} sent to ${inspection.driver} — Complete vehicle inspection for ${vehicle.licensePlate}!`, { duration: 4000 });
    }
  };

  const handleOpenChecklist = (inspection: InspectionRecord) => {
    setActiveInspection({ ...inspection });
    setInspectionDialogOpen(true);
  };

  const handleChecklistToggle = (itemId: string, checked: boolean) => {
    if (!activeInspection) return;
    setActiveInspection(prev => prev ? {
      ...prev,
      checklist: prev.checklist.map(c => c.itemId === itemId ? { ...c, checked } : c),
    } : null);
  };

  const handleCompleteInspection = () => {
    if (!activeInspection) return;
    const allChecked = activeInspection.checklist.every(c => c.checked);
    if (!allChecked) {
      toast.error('All checklist items must be checked before completing the inspection.');
      return;
    }
    onUpdateInspection(activeInspection.id, {
      status: 'completed',
      completedDate: new Date().toISOString().split('T')[0],
      checklist: activeInspection.checklist,
      reminderCount: 0,
      escalatedToManager: false,
    });
    setInspectionDialogOpen(false);
    toast.success('✅ Vehicle inspection completed!');
  };

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
        {overdueInspections.length > 0 && (
          <Badge className="bg-destructive text-destructive-foreground text-xs animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" /> Inspection overdue
          </Badge>
        )}
        <Badge className={cn("text-xs", statusColors[vehicle.status])}>
          {statusLabels[vehicle.status]}
        </Badge>
        <Select value={vehicle.status} onValueChange={(v) => onUpdateVehicle(vehicle.id, { status: v as Vehicle['status'] })}>
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
            <Button size="sm" variant="ghost" onClick={() => onAssignProject(vehicle.id, undefined)}>Unassign</Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inspections" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 w-fit">
          <TabsTrigger value="inspections" className="relative">
            Inspections ({inspectionRecords.length})
            {overdueInspections.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center font-bold">
                {overdueInspections.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mileage">Mileage ({mileageEntries.length})</TabsTrigger>
          <TabsTrigger value="service">Service ({serviceRecords.length})</TabsTrigger>
          <TabsTrigger value="tires">Tires ({tireRecords.length})</TabsTrigger>
        </TabsList>

        {/* Inspections Tab */}
        <TabsContent value="inspections" className="flex-1 overflow-auto px-6 pb-6">
          <div className="flex justify-between items-center mb-3 mt-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Vehicle Inspections</h3>
              <p className="text-xs text-muted-foreground">
                Monthly check · {INSPECTION_INTERVAL_DAYS}-day interval · Escalates after {ESCALATION_AFTER_REMINDERS} ignored reminders
                {vehicle.fuelType === 'electric' && <span className="ml-1 text-primary">· ⚡ Electric vehicle (oil/exhaust checks skipped)</span>}
                {customExclusions.length > 0 && <span className="ml-1 text-muted-foreground/80">· {customExclusions.length} custom exclusion{customExclusions.length > 1 ? 's' : ''}</span>}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowChecklistConfig(!showChecklistConfig)}>
              <Settings2 className="w-3 h-3 mr-1" /> Customize Checklist
            </Button>
          </div>

          {/* Checklist customization panel */}
          {showChecklistConfig && (
            <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border">
              <h4 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Checklist Configuration
                <Badge variant="secondary" className="text-[10px]">
                  {fuelTypeLabels[vehicle.fuelType]}
                  {vehicle.fuelType === 'electric' && <Zap className="w-3 h-3 ml-0.5 inline" />}
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Active: {activeChecklist.length} items · Excluded by fuel type: {inspectionChecklist.length - fuelFilteredChecklist.length} · Custom excluded: {customExclusions.length}
              </p>
              {Object.entries(inspectionCategoryLabels).map(([catKey, catLabel]) => {
                const allItems = inspectionChecklist.filter(i => i.category === catKey);
                if (allItems.length === 0) return null;
                return (
                  <div key={catKey} className="mb-3">
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{catLabel}</h5>
                    <div className="space-y-1">
                      {allItems.map(item => {
                        const excludedByFuel = item.excludeFuelTypes?.includes(vehicle.fuelType);
                        const excludedCustom = customExclusions.includes(item.id);
                        const isActive = !excludedByFuel && !excludedCustom;
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 p-1.5 rounded text-sm cursor-pointer transition-colors",
                              excludedByFuel ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/40"
                            )}
                          >
                            <Checkbox
                              checked={isActive}
                              disabled={excludedByFuel}
                              onCheckedChange={(checked) => {
                                if (excludedByFuel) return;
                                setCustomExclusions(prev =>
                                  checked
                                    ? prev.filter(id => id !== item.id)
                                    : [...prev, item.id]
                                );
                              }}
                            />
                            <span className={cn(!isActive && "line-through text-muted-foreground")}>{item.label}</span>
                            {excludedByFuel && (
                              <Badge variant="outline" className="text-[9px] ml-auto">N/A for {fuelTypeLabels[vehicle.fuelType]}</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            {[...inspectionRecords].sort((a, b) => b.dueDate.localeCompare(a.dueDate)).map(inspection => {
              const config = inspectionStatusConfig[inspection.status];
              const StatusIcon = config.icon;
              const checkedCount = inspection.checklist.filter(c => c.checked).length;
              const totalCount = inspection.checklist.length;
              const isActionable = inspection.status === 'pending' || inspection.status === 'overdue' || inspection.status === 'escalated';

              return (
                <div key={inspection.id} className={cn(
                  "p-4 rounded-lg border",
                  inspection.status === 'overdue' ? "border-status-on-hold/50 bg-status-on-hold/5" :
                  inspection.status === 'escalated' ? "border-destructive/50 bg-destructive/5" :
                  "border-border bg-muted/20"
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={cn("w-4 h-4",
                        inspection.status === 'completed' ? "text-status-completed" :
                        inspection.status === 'overdue' ? "text-status-on-hold" :
                        inspection.status === 'escalated' ? "text-destructive" :
                        "text-status-scheduled"
                      )} />
                      <span className="text-sm font-medium text-foreground">
                        Monthly Inspection
                      </span>
                      <Badge className={cn("text-[10px]", config.color)}>{config.label}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Due: {inspection.dueDate}</span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <span>Driver: <span className="font-medium text-foreground">{inspection.driver}</span></span>
                    <span>Checklist: {checkedCount}/{totalCount}</span>
                    {inspection.reminderCount > 0 && (
                      <span className="text-status-on-hold">
                        <Bell className="w-3 h-3 inline mr-0.5" />
                        {inspection.reminderCount} reminder{inspection.reminderCount > 1 ? 's' : ''} sent
                      </span>
                    )}
                    {inspection.escalatedToManager && (
                      <span className="text-destructive font-medium">
                        <ShieldAlert className="w-3 h-3 inline mr-0.5" />
                        Escalated {inspection.escalatedDate}
                      </span>
                    )}
                    {inspection.completedDate && (
                      <span className="text-status-completed">Completed: {inspection.completedDate}</span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-muted rounded-full mb-3">
                    <div
                      className={cn("h-full rounded-full transition-all",
                        inspection.status === 'completed' ? "bg-status-completed" : "bg-primary"
                      )}
                      style={{ width: `${(checkedCount / totalCount) * 100}%` }}
                    />
                  </div>

                  {isActionable && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleOpenChecklist(inspection)}>
                        <ClipboardCheck className="w-3 h-3 mr-1" /> Fill Checklist
                      </Button>
                      <Button
                        size="sm"
                        variant={inspection.reminderCount >= ESCALATION_AFTER_REMINDERS - 1 ? "destructive" : "secondary"}
                        onClick={() => handleSendReminder(inspection)}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        {inspection.reminderCount >= ESCALATION_AFTER_REMINDERS - 1 ? 'Send & Escalate' : `Send Reminder #${inspection.reminderCount + 1}`}
                      </Button>
                    </div>
                  )}

                  {inspection.status === 'completed' && (
                    <Button size="sm" variant="ghost" onClick={() => handleOpenChecklist(inspection)}>
                      <ClipboardCheck className="w-3 h-3 mr-1" /> View Checklist
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

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
      
      {/* Inspection Checklist Dialog */}
      <Dialog open={inspectionDialogOpen} onOpenChange={setInspectionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Vehicle Inspection Checklist
              {activeInspection && (
                <Badge className={cn("text-[10px] ml-2", inspectionStatusConfig[activeInspection.status]?.color)}>
                  {inspectionStatusConfig[activeInspection.status]?.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {activeInspection && (
            <div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4 pb-3 border-b border-border">
                <span>Vehicle: <span className="font-medium text-foreground">{vehicle.make} {vehicle.model} ({vehicle.licensePlate})</span></span>
                <span>Driver: <span className="font-medium text-foreground">{activeInspection.driver}</span></span>
                <span>Due: {activeInspection.dueDate}</span>
              </div>
              {Object.entries(inspectionCategoryLabels).map(([catKey, catLabel]) => {
                const items = activeChecklist.filter(i => i.category === catKey);
                if (items.length === 0) return null;
                return (
                  <div key={catKey} className="mb-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{catLabel}</h4>
                    <div className="space-y-1.5">
                      {items.map(item => {
                        const checkState = activeInspection.checklist.find(c => c.itemId === item.id);
                        const isCompleted = activeInspection.status === 'completed';
                        return (
                          <label
                            key={item.id}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer",
                              checkState?.checked ? "bg-status-completed/10" : "hover:bg-muted/30"
                            )}
                          >
                            <Checkbox
                              checked={checkState?.checked || false}
                              onCheckedChange={(checked) => handleChecklistToggle(item.id, !!checked)}
                              disabled={isCompleted}
                            />
                            <span className={cn("text-sm", checkState?.checked ? "text-muted-foreground line-through" : "text-foreground")}>
                              {item.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectionDialogOpen(false)}>Close</Button>
            {activeInspection && activeInspection.status !== 'completed' && (
              <Button onClick={handleCompleteInspection}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Complete Inspection
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
