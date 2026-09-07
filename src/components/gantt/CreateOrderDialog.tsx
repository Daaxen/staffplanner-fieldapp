import { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, MapPin, Maximize2, Minimize2, Plus, Trash2, GripVertical, PenTool, Package, Paperclip, X, FileText, Image, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { installers, projects, locationDistances, type Project, type ProjectStatus, type ProjectType, type TransportStop, type GoodsItem, type Attachment, projectTypeLabels } from '@/data/mockData';
import { Checkbox } from '@/components/ui/checkbox';
import { useClients } from '@/lib/clientStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOrder: (project: Project) => void;
}

const generateProjectId = () => {
  const seq = Math.floor(Math.random() * 90000) + 10000;
  return `P-${seq}`;
};

const generateStopId = () => `ts-${Math.random().toString(36).slice(2, 8)}`;
const generateGoodsId = () => `gi-${Math.random().toString(36).slice(2, 8)}`;


const CreateOrderDialog = ({ open, onOpenChange, onCreateOrder }: CreateOrderDialogProps) => {
  const projectId = useMemo(() => generateProjectId(), [open]);
  const [clientRows] = useClients();
  const clients = useMemo(() => {
    const names = new Set<string>();
    clientRows.forEach((c) => c.name && names.add(c.name));
    projects.forEach((p) => p.client && names.add(p.client));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [clientRows]);
  const clientExtra = useMemo(() => {
    const map = new Map<string, string>();
    clientRows.forEach((c) => {
      const label = [c.customerNumber, c.id, c.region].filter(Boolean).join(' · ');
      if (c.name) map.set(c.name, label);
    });
    return map;
  }, [clientRows]);
  const [projectType, setProjectType] = useState<ProjectType>('installation');
  const [name, setName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [client, setClient] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState('17:00');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [isFlexOrder, setIsFlexOrder] = useState(false);
  const [selectedInstallers, setSelectedInstallers] = useState<string[]>([]);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const clientInputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transport-specific
  const [transportStops, setTransportStops] = useState<TransportStop[]>([
    { id: generateStopId(), type: 'pickup', address: '' },
    { id: generateStopId(), type: 'delivery', address: '' },
  ]);
  const [vehicleType, setVehicleType] = useState('');
  const [goodsItems, setGoodsItems] = useState<GoodsItem[]>([
    { id: generateGoodsId() },
  ]);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const resetForm = () => {
    setProjectType('installation');
    setName('');
    setProjectNumber('');
    setClient('');
    setLocation('');
    setDescription('');
    setStartDate(undefined);
    setStartTime('08:00');
    setEndDate(undefined);
    setEndTime('17:00');
    setEstimatedHours('');
    setIsFlexOrder(false);
    setSelectedInstallers([]);
    setShowClientSuggestions(false);
    setTransportStops([
      { id: generateStopId(), type: 'pickup', address: '' },
      { id: generateStopId(), type: 'delivery', address: '' },
    ]);
    setVehicleType('');
    setGoodsItems([{ id: generateGoodsId() }]);
    setAttachments([]);
  };

  // Suitability scoring
  const getInstallerSuitability = (inst: typeof installers[0]) => {
    if (!startDate || !endDate) return null;
    const projStart = format(startDate, 'yyyy-MM-dd');
    const projEnd = format(endDate, 'yyyy-MM-dd');
    const projLocation = projectType === 'transport' ? transportStops[0]?.address || '' : location;

    // Occupancy: count overlapping projects in the period
    const overlapping = projects.filter(p =>
      p.assigneeIds.includes(inst.id) &&
      p.startDate <= projEnd &&
      p.endDate >= projStart &&
      !['completed', 'cancelled'].includes(p.status)
    );
    const occupancyScore = Math.max(0, 100 - overlapping.length * 40); // 0 projects = 100, 1 = 60, 2 = 20, 3+ = 0

    // Absence check
    const hasAbsence = inst.absences.some(a => a.startDate <= projEnd && a.endDate >= projStart);
    if (hasAbsence) return { score: 0, label: 'Absent', color: 'text-destructive' as const };

    // Proximity
    let proximityScore = 50; // default if no match
    const distances = locationDistances[inst.baseLocation];
    if (distances && projLocation) {
      const dist = distances[projLocation];
      if (dist !== undefined) {
        proximityScore = dist <= 5 ? 100 : dist <= 10 ? 75 : dist <= 15 ? 50 : dist <= 25 ? 25 : 10;
      }
    }

    const totalScore = Math.round(occupancyScore * 0.6 + proximityScore * 0.4);
    const label = totalScore >= 70 ? 'Good fit' : totalScore >= 40 ? 'Fair' : 'Poor fit';
    const color = totalScore >= 70 ? 'text-green-600' : totalScore >= 40 ? 'text-amber-500' : 'text-destructive';

    return { score: totalScore, label, color, occupancy: overlapping.length, proximity: distances?.[projLocation] };
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientInputRef.current && !clientInputRef.current.contains(e.target as Node)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClientChange = (value: string) => {
    setClient(value);
    setHighlightedIndex(-1);
    const filtered = value.trim()
      ? clients.filter(c => c.toLowerCase().includes(value.toLowerCase()))
      : clients;
    setClientSuggestions(filtered);
    setShowClientSuggestions(filtered.length > 0);
  };

  const selectClient = (c: string) => {
    setClient(c);
    setShowClientSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleClientKeyDown = (e: React.KeyboardEvent) => {
    if (!showClientSuggestions || clientSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % clientSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev <= 0 ? clientSuggestions.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectClient(clientSuggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowClientSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSubmit = () => {
    if (!name || !client || !startDate || !endDate) return;

    const status: ProjectStatus = selectedInstallers.length > 0 ? 'scheduled' : 'open';

    const project: Project = {
      id: projectId,
      name,
      projectNumber: projectNumber || undefined,
      projectType,
      client,
      location: projectType === 'transport' ? transportStops[0]?.address || '' : location,
      status,
      assigneeIds: selectedInstallers,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      estimatedHours: projectType !== 'transport' && estimatedHours ? parseFloat(estimatedHours) : undefined,
      isFlexOrder,
      description: description || undefined,
      ...(projectType === 'transport' && {
        transportStops: transportStops.filter(s => s.address.trim()),
        vehicleType: vehicleType || undefined,
        goodsItems: goodsItems.filter(g => g.description || g.quantity || g.lengthCm || g.weightKg),
      }),
    };

    onCreateOrder(project);
    resetForm();
    onOpenChange(false);
  };

  const toggleInstaller = (id: string) => {
    setSelectedInstallers(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Transport stop helpers
  const updateStop = (id: string, updates: Partial<TransportStop>) => {
    setTransportStops(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addStop = () => {
    setTransportStops(prev => {
      const lastDeliveryIdx = prev.length - 1;
      const newStop: TransportStop = { id: generateStopId(), type: 'delivery', address: '' };
      const copy = [...prev];
      copy.splice(lastDeliveryIdx, 0, { ...newStop, type: 'pickup' });
      return copy;
    });
  };

  const removeStop = (id: string) => {
    if (transportStops.length <= 2) return;
    setTransportStops(prev => prev.filter(s => s.id !== id));
  };

  // Goods helpers
  const updateGoodsItem = (id: string, updates: Partial<GoodsItem>) => {
    setGoodsItems(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  const addGoodsItem = () => {
    setGoodsItems(prev => [...prev, { id: generateGoodsId() }]);
  };

  const removeGoodsItem = (id: string) => {
    if (goodsItems.length <= 1) return;
    setGoodsItems(prev => prev.filter(g => g.id !== id));
  };

  // Attachment helpers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = Array.from(files).map(f => ({
      id: `att-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isValid = name.trim() && client.trim() && startDate && endDate && startDate <= endDate;

  const typeButtons: { value: ProjectType; icon: string }[] = [
    { value: 'installation', icon: '🔧' },
    { value: 'site-survey', icon: '📋' },
    { value: 'transport', icon: '🚛' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg font-semibold">New Project</DialogTitle>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{projectId}</span>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Project Type */}
          <div className="grid gap-1.5">
            <Label>Project Type</Label>
            <div className="flex gap-2">
              {typeButtons.map(({ value, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProjectType(value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium transition-colors",
                    projectType === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span>{icon}</span>
                  <span>{projectTypeLabels[value]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Project Name & PO Number */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="order-name">Project Name *</Label>
              <Input id="order-name" placeholder="e.g. IKEA Kitchen Install" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="order-number">Project Number</Label>
              <Input id="order-number" placeholder="e.g. Client PO number" value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} />
            </div>
          </div>

          {/* Client (autocomplete) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 relative" ref={clientInputRef}>
              <Label htmlFor="order-client">Client *</Label>
              <Input
                id="order-client"
                placeholder="Start typing..."
                value={client}
                onChange={(e) => handleClientChange(e.target.value)}
                onFocus={() => handleClientChange(client)}
                onKeyDown={handleClientKeyDown}
                autoComplete="off"
              />
              {showClientSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-border rounded-md bg-popover shadow-md max-h-[140px] overflow-y-auto">
                  {clientSuggestions.map((c, idx) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm transition-colors",
                        idx === highlightedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                      )}
                      onClick={() => selectClient(c)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location — only for non-transport */}
            {projectType !== 'transport' && (
              <div className="grid gap-1.5">
                <Label htmlFor="order-location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="order-location" placeholder="Search address..." className="pl-8" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
              </div>
            )}

            {/* Vehicle type — transport only */}
            {projectType === 'transport' && (
              <div className="grid gap-1.5">
                <Label htmlFor="vehicle-type">Vehicle Type</Label>
                <Input id="vehicle-type" placeholder="e.g. Van, Truck" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
              </div>
            )}
          </div>

          {/* Mini Map for non-transport */}
          {projectType !== 'transport' && location.trim() && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Map Preview</Label>
                <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setMapExpanded(!mapExpanded)}>
                  {mapExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
              <div className={cn(
                "rounded-md border border-border bg-muted/30 flex items-center justify-center text-muted-foreground transition-all overflow-hidden",
                mapExpanded ? "h-[200px]" : "h-[80px]"
              )}>
                <div className="flex flex-col items-center gap-1">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="text-xs">{location}</span>
                  <span className="text-[10px] text-muted-foreground/60">Map integration pending — Google Maps API</span>
                </div>
              </div>
            </div>
          )}

          {/* Dates & Times */}
          {projectType === 'transport' && (
            <div className="grid grid-cols-1 gap-3">
              <div className="grid gap-1.5">
                <Label>Date and Time *</Label>
                <div className="grid grid-cols-4 gap-3">
                  <div className="grid gap-1.5">
                    <Popover open={startOpen} onOpenChange={setStartOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal text-xs px-2", !startDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {startDate ? format(startDate, 'MMM d') : 'Pick'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={startDate} onSelect={(date) => { setStartDate(date); setStartOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-1.5">
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-xs px-2" />
                  </div>
                  <div className="grid gap-1.5">
                    <Popover open={endOpen} onOpenChange={setEndOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal text-xs px-2", !endDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {endDate ? format(endDate, 'MMM d') : 'Pick'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={endDate} onSelect={(date) => { setEndDate(date); setEndOpen(false); }} disabled={(date) => startDate ? date < startDate : false} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="grid gap-1.5">
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-xs px-2" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {projectType !== 'transport' && (
            <div className="grid grid-cols-4 gap-3">
              <div className="grid gap-1.5">
                <Label>Earliest Start *</Label>
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal text-xs px-2", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {startDate ? format(startDate, 'MMM d') : 'Pick'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={(date) => { setStartDate(date); setStartOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-xs px-2" />
              </div>
              <div className="grid gap-1.5">
                <Label>Deadline *</Label>
                <Popover open={endOpen} onOpenChange={setEndOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal text-xs px-2", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {endDate ? format(endDate, 'MMM d') : 'Pick'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={(date) => { setEndDate(date); setEndOpen(false); }} disabled={(date) => startDate ? date < startDate : false} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1.5">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-xs px-2" />
              </div>
            </div>
          )}

          {/* Estimated hours & Flex order */}
          <div className={cn("grid gap-3", projectType !== 'transport' ? "grid-cols-2" : "grid-cols-1")}>
            {projectType !== 'transport' && (
              <div className="grid gap-1.5">
                <Label htmlFor="est-hours">Estimated Hours</Label>
                <Input id="est-hours" type="number" min="0" step="0.5" placeholder="e.g. 8" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>&nbsp;</Label>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <Checkbox checked={isFlexOrder} onCheckedChange={(checked) => setIsFlexOrder(!!checked)} />
                <span className="text-sm">Flex Order</span>
                <span className="text-xs text-muted-foreground">↔ Flexible within period</span>
              </label>
            </div>
          </div>

          {/* Transport Stops */}
          {projectType === 'transport' && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Route Stops</Label>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={addStop}>
                  <Plus className="h-3 w-3" /> Add Stop
                </Button>
              </div>
              <div className="border border-input rounded-md divide-y divide-border">
                {transportStops.map((stop, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === transportStops.length - 1;
                  const canRemove = transportStops.length > 2 && !isFirst && !isLast;

                  return (
                    <div key={stop.id} className="flex items-start gap-2 p-2.5">
                      <div className="flex flex-col items-center pt-1.5 shrink-0 w-5">
                        <div className={cn(
                          "w-3 h-3 rounded-full border-2 shrink-0",
                          isFirst ? "border-green-500 bg-green-500/20" :
                            isLast ? "border-red-500 bg-red-500/20" :
                              "border-amber-500 bg-amber-500/20"
                        )} />
                        {!isLast && <div className="w-0.5 h-6 bg-border mt-0.5" />}
                      </div>

                      <div className="flex-1 grid gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isFirst ? 'Pickup' : isLast ? 'Final Delivery' : `Stop ${idx}`}
                          </span>
                          <select
                            value={stop.type}
                            onChange={(e) => updateStop(stop.id, { type: e.target.value as 'pickup' | 'delivery' })}
                            className="text-[10px] bg-transparent border border-input rounded px-1 py-0.5 text-muted-foreground"
                          >
                            <option value="pickup">Pickup</option>
                            <option value="delivery">Delivery</option>
                          </select>
                        </div>
                        <div className="flex gap-1">
                          <div className="relative flex-1">
                            <MapPin className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Address..."
                              className="h-8 text-xs pl-7"
                              value={stop.address}
                              onChange={(e) => updateStop(stop.id, { address: e.target.value })}
                            />
                          </div>
                          {stop.address.trim() && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 h-8 w-8 flex items-center justify-center rounded border border-input bg-background hover:bg-accent transition-colors"
                              title="Open in Google Maps"
                            >
                              <MapPin className="h-3.5 w-3.5 text-primary" />
                            </a>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Contact name" className="h-7 text-xs" value={stop.contactName || ''} onChange={(e) => updateStop(stop.id, { contactName: e.target.value })} />
                          <Input placeholder="Phone" className="h-7 text-xs" value={stop.contactPhone || ''} onChange={(e) => updateStop(stop.id, { contactPhone: e.target.value })} />
                        </div>
                        <Input placeholder="Notes for this stop..." className="h-7 text-xs" value={stop.notes || ''} onChange={(e) => updateStop(stop.id, { notes: e.target.value })} />
                        {stop.type === 'delivery' && (
                          <label className="flex items-center gap-2 cursor-pointer mt-0.5">
                            <Checkbox checked={stop.requiresSignature ?? true} onCheckedChange={(checked) => updateStop(stop.id, { requiresSignature: !!checked })} />
                            <PenTool className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Require digital signature on delivery</span>
                          </label>
                        )}
                      </div>

                      {canRemove ? (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeStop(stop.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <div className="w-7 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Goods Details — Transport only */}
          {projectType === 'transport' && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  Goods Details
                  <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={addGoodsItem}>
                  <Plus className="h-3 w-3" /> Add Another
                </Button>
              </div>
              <div className="border border-input rounded-md divide-y divide-border">
                {goodsItems.map((item, idx) => (
                  <div key={item.id} className="p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Colli {idx + 1}</span>
                      {goodsItems.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeGoodsItem(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Input placeholder="Description of goods..." className="h-7 text-xs" value={item.description || ''} onChange={(e) => updateGoodsItem(item.id, { description: e.target.value })} />
                    <div className="grid grid-cols-5 gap-2">
                      <div className="grid gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Pcs</span>
                        <Input type="number" min="0" placeholder="0" className="h-7 text-xs" value={item.quantity ?? ''} onChange={(e) => updateGoodsItem(item.id, { quantity: e.target.value ? parseInt(e.target.value) : undefined })} />
                      </div>
                      <div className="grid gap-0.5">
                        <span className="text-[9px] text-muted-foreground">L (cm)</span>
                        <Input type="number" min="0" placeholder="0" className="h-7 text-xs" value={item.lengthCm ?? ''} onChange={(e) => updateGoodsItem(item.id, { lengthCm: e.target.value ? parseInt(e.target.value) : undefined })} />
                      </div>
                      <div className="grid gap-0.5">
                        <span className="text-[9px] text-muted-foreground">W (cm)</span>
                        <Input type="number" min="0" placeholder="0" className="h-7 text-xs" value={item.widthCm ?? ''} onChange={(e) => updateGoodsItem(item.id, { widthCm: e.target.value ? parseInt(e.target.value) : undefined })} />
                      </div>
                      <div className="grid gap-0.5">
                        <span className="text-[9px] text-muted-foreground">H (cm)</span>
                        <Input type="number" min="0" placeholder="0" className="h-7 text-xs" value={item.heightCm ?? ''} onChange={(e) => updateGoodsItem(item.id, { heightCm: e.target.value ? parseInt(e.target.value) : undefined })} />
                      </div>
                      <div className="grid gap-0.5">
                        <span className="text-[9px] text-muted-foreground">Kg</span>
                        <Input type="number" min="0" step="0.1" placeholder="0" className="h-7 text-xs" value={item.weightKg ?? ''} onChange={(e) => updateGoodsItem(item.id, { weightKg: e.target.value ? parseFloat(e.target.value) : undefined })} />
                      </div>
                    </div>
                  </div>
                ))
                /* Totals row */
                }
                {(() => {
                  const totalPcs = goodsItems.reduce((sum, g) => sum + (g.quantity || 0), 0);
                  const totalWeight = goodsItems.reduce((sum, g) => sum + (g.weightKg || 0), 0);
                  const totalVolume = goodsItems.reduce((sum, g) => {
                    const l = g.lengthCm || 0; const w = g.widthCm || 0; const h = g.heightCm || 0;
                    return sum + (l * w * h) / 1000000;
                  }, 0);
                  if (totalPcs === 0 && totalWeight === 0 && totalVolume === 0) return null;
                  return (
                    <div className="px-2.5 py-2 bg-muted/40 flex items-center gap-4 text-xs">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Totals</span>
                      {totalPcs > 0 && <span className="text-foreground font-medium">{totalPcs} pcs</span>}
                      {totalWeight > 0 && <span className="text-foreground font-medium">{totalWeight.toFixed(1)} kg</span>}
                      {totalVolume > 0 && <span className="text-foreground font-medium">{totalVolume.toFixed(3)} m³</span>}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Assign Installers with suitability */}
          <div className="grid gap-1.5">
            <Label>{projectType === 'transport' ? 'Assign Drivers' : 'Assign Installers'}</Label>
            <div className="border border-input rounded-md p-3 grid gap-2 max-h-[180px] overflow-y-auto">
              <TooltipProvider>
                {installers
                  .map(inst => ({ inst, suit: getInstallerSuitability(inst) }))
                  .sort((a, b) => (b.suit?.score ?? 50) - (a.suit?.score ?? 50))
                  .map(({ inst, suit }) => (
                  <label key={inst.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent rounded px-1 py-0.5 transition-colors">
                    <Checkbox checked={selectedInstallers.includes(inst.id)} onCheckedChange={() => toggleInstaller(inst.id)} disabled={suit?.score === 0} />
                    <span className={cn(suit?.score === 0 && "line-through text-muted-foreground")}>{inst.name}</span>
                    {suit && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn("text-[10px] font-medium ml-1", suit.color)}>
                            {suit.score === 0 ? (
                              <XCircle className="h-3.5 w-3.5 inline" />
                            ) : suit.score >= 70 ? (
                              <CheckCircle2 className="h-3.5 w-3.5 inline" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 inline" />
                            )}
                            {' '}{suit.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="text-xs">
                          {suit.score === 0 ? (
                            <span>Absent during project period</span>
                          ) : (
                            <div className="space-y-0.5">
                              <div>Score: {suit.score}%</div>
                              <div>Projects in period: {suit.occupancy}</div>
                              {suit.proximity !== undefined && <div>Distance: ~{suit.proximity} km</div>}
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{inst.type === 'sub-vendor' ? 'Sub' : 'Own'}</span>
                  </label>
                ))}
              </TooltipProvider>
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="order-desc">Description</Label>
            <Textarea id="order-desc" placeholder="Optional notes..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {/* Attachments */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                Attachments
              </Label>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-3 w-3" /> Add Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            {attachments.length > 0 && (
              <div className="border border-input rounded-md divide-y divide-border">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 px-2.5 py-1.5">
                    {att.type.startsWith('image/') ? (
                      <Image className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs text-foreground truncate flex-1">{att.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(att.size)}</span>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeAttachment(att.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {attachments.length === 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-md py-4 flex flex-col items-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors cursor-pointer"
              >
                <Paperclip className="h-5 w-5" />
                <span className="text-xs">Drop files or click to attach</span>
                <span className="text-[10px]">Images, PDFs, documents</span>
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid}>Create Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;
