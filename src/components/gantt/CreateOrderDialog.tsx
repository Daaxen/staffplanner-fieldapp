import { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, MapPin, Maximize2, Minimize2, Plus, Trash2, GripVertical, PenTool, Package, Paperclip, X, FileText, Image, CheckCircle2, AlertTriangle, XCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  PROJECT_TEMPLATES,
  DEFAULT_TEMPLATE_ID,
  TEMPLATE_FIELD_LABELS,
  getTemplate,
  type TemplateFieldId,
} from '@/lib/projectTemplates';
import { installers, projects, locationDistances, type Project, type ProjectStatus, type ProjectType, type TransportStop, type GoodsItem, type Attachment, projectTypeLabels } from '@/data/mockData';
import { Checkbox } from '@/components/ui/checkbox';
import { useClients } from '@/lib/clientStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AddressAutocomplete from '@/components/maps/AddressAutocomplete';
import { countryFromCode, countryFromText } from '@/lib/perDiem';
import { SearchSelect } from '@/components/ui/search-select';
import { usePerDiemCountries } from '@/hooks/usePerDiem';
import MiniMap from '@/components/maps/MiniMap';
import ConflictPanel from '@/components/scheduling/ConflictPanel';
import { detectConflicts, installerConflicts, hasBlocking, type AssignmentDraft } from '@/lib/schedulingConflicts';
import { vehicles } from '@/data/fleetData';
import { toast } from 'sonner';
import RecommendedInstallers from '@/components/scheduling/RecommendedInstallers';
import { recommendInstallers } from '@/lib/assignmentRecommendations';
import { projectDateRangeError } from '@/lib/validation/dates';
import { saveBookings, findBookingConflicts, type BookingConflict } from '@/lib/bookings';
import { registerBookingOverride } from '@/lib/appData';
import TravelDayToggles from '@/components/gantt/TravelDayToggles';
import BookingOverrideDialog from '@/components/scheduling/BookingOverrideDialog';
import { normalizeCountry, type CountryProvenance } from '@/lib/foreignWork/countries';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOrder: (project: Project) => void;
  /** Create the work order inside this project (optional grouping). */
  projectGroupId?: string;
}

const generateProjectId = () => {
  const seq = Math.floor(Math.random() * 90000) + 10000;
  return `P-${seq}`;
};

const generateStopId = () => `ts-${Math.random().toString(36).slice(2, 8)}`;
const generateGoodsId = () => `gi-${Math.random().toString(36).slice(2, 8)}`;


const CreateOrderDialog = ({ open, onOpenChange, onCreateOrder, projectGroupId }: CreateOrderDialogProps) => {
  const projectId = useMemo(() => generateProjectId(), [open]);
  const [clientRows] = useClients();
  // Orders are linked to a customer record — only registered customers can be picked.
  const clients = useMemo(
    () => [...clientRows].filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name)),
    [clientRows],
  );
  const clientLabel = (c: (typeof clientRows)[number]) =>
    [c.customerNumber, c.id, c.region].filter(Boolean).join(' · ');
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const template = useMemo(() => getTemplate(templateId), [templateId]);
  const [projectType, setProjectType] = useState<ProjectType>('installation');
  const [name, setName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [client, setClient] = useState('');
  const [clientRef, setClientRef] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<typeof clientRows>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [location, setLocation] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [countryManual, setCountryManual] = useState(false);
  const [countryProvenance, setCountryProvenance] = useState<CountryProvenance>('DEFAULTED');
  const countries = usePerDiemCountries();
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState('17:00');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [isFlexOrder, setIsFlexOrder] = useState(false);
  const [worksWeekends, setWorksWeekends] = useState(false);
  const [travelBefore, setTravelBefore] = useState(false);
  const [travelAfter, setTravelAfter] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [bookingConflicts, setBookingConflicts] = useState<BookingConflict[]>([]);
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
    setTemplateId(DEFAULT_TEMPLATE_ID);
    setTravelBefore(false);
    setTravelAfter(false);
    setProjectType('installation');
    setName('');
    setProjectNumber('');
    setClient('');
    setClientRef('');
    setLocation('');
    setCountry(null);
    setCountryManual(false);
    setCountryProvenance('DEFAULTED');
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

  // ---- Scheduling conflict detection -------------------------------------
  const conflictDraft: AssignmentDraft | null = useMemo(() => {
    if (!startDate || !endDate) return null;
    return {
      projectId,
      name,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: projectType === 'transport' ? transportStops[0]?.address || '' : location,
      lat: locationCoords?.lat,
      lng: locationCoords?.lng,
    };
  }, [projectId, name, startDate, endDate, startTime, endTime, projectType, transportStops, location, locationCoords]);

  const conflicts = useMemo(() => {
    if (!conflictDraft) return [];
    return detectConflicts({
      installerIds: selectedInstallers,
      draft: conflictDraft,
      installers,
      projects,
      vehicles,
    });
  }, [conflictDraft, selectedInstallers]);

  const conflictsFor = (installerId: string) => {
    if (!conflictDraft) return [];
    const inst = installers.find(i => i.id === installerId);
    return inst ? installerConflicts(inst, conflictDraft, projects) : [];
  };

  // ---- Intelligent assignment recommendations ----------------------------
  const recommendations = useMemo(() => {
    if (!conflictDraft) return [];
    return recommendInstallers({
      installers,
      projects,
      draft: conflictDraft,
      projectType,
      topN: 3,
    });
  }, [conflictDraft, projectType]);

  const recommendationFor = (installerId: string) =>
    recommendations.find(r => r.installer.id === installerId);


  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientInputRef.current && !clientInputRef.current.contains(e.target as Node)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Live booking conflicts from the booking register (shown before saving)
  useEffect(() => {
    let cancelled = false;
    if (!startDate || !endDate || selectedInstallers.length === 0) {
      setBookingConflicts([]);
      return;
    }
    const start = new Date(`${format(startDate, 'yyyy-MM-dd')}T${startTime || '00:00'}:00`).toISOString();
    const end = new Date(`${format(endDate, 'yyyy-MM-dd')}T${endTime || '23:59'}:00`).toISOString();
    findBookingConflicts(selectedInstallers, start, end)
      .then(res => { if (!cancelled) setBookingConflicts(res); })
      .catch(() => { if (!cancelled) setBookingConflicts([]); });
    return () => { cancelled = true; };
  }, [selectedInstallers, startDate, endDate, startTime, endTime]);

  const handleClientChange = (value: string) => {
    setClient(value);
    // typing again clears the link until a customer is picked from the register
    setClientRef('');
    setHighlightedIndex(-1);
    const q = value.trim().toLowerCase();
    const filtered = q
      ? clients.filter(
          c =>
            c.name.toLowerCase().includes(q) || clientLabel(c).toLowerCase().includes(q),
        )
      : clients;
    setClientSuggestions(filtered);
    setShowClientSuggestions(filtered.length > 0);
  };

  const selectClient = (c: (typeof clientRows)[number]) => {
    setClient(c.name);
    setClientRef(c.id);
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

  const persistBookings = async (project: Project, overrideReason?: string) => {
    // the reason also travels with any follow-up save of the same order
    if (overrideReason) registerBookingOverride(project.id, overrideReason);
    const res = await saveBookings({
      projectRef: project.id,
      installerIds: project.assigneeIds,
      startDate: project.startDate,
      endDate: project.endDate,
      startTime: project.startTime,
      endTime: project.endTime,
      overrideReason,
    });
    if (res.ok) {
      if (overrideReason) toast.success('Booking saved with an override reason (logged)');
      setPendingProject(null);
      setOverrideOpen(false);
      return;
    }
    if (res.conflict) {
      setPendingProject(project);
      setOverrideOpen(true);
      return;
    }
    toast.error('Could not save the booking', { description: res.error });
  };

  const handleSubmit = () => {
    if (!name || !clientRef || !startDate || !endDate) return;
    if (hasBlocking(conflicts)) {
      toast.error('Scheduling conflict', {
        description: 'Resolve the blocking conflicts before assigning these resources.',
      });
      return;
    }


    const status: ProjectStatus = selectedInstallers.length > 0 ? 'scheduled' : 'open';

    const project: Project = {
      id: projectId,
      name,
      projectNumber: projectNumber || undefined,
      projectGroupId: projectGroupId || undefined,
      projectType,
      templateId,
      clientId: clientRef,
      client,
      location: projectType === 'transport' ? transportStops[0]?.address || '' : location,
      ...(projectType !== 'transport' && locationCoords
        ? { locationLat: locationCoords.lat, locationLng: locationCoords.lng }
        : {}),
      ...(projectType !== 'transport' ? { country: country ?? countryFromText(`${name} ${location}`) ?? 'Sverige', countryCode: normalizeCountry(country ?? countryFromText(`${name} ${location}`) ?? 'Sverige'), countryProvenance: country ? countryProvenance : countryFromText(`${name} ${location}`) ? 'DERIVED' : 'DEFAULTED' } : { countryProvenance: 'UNKNOWN' as const }),
      status,
      assigneeIds: selectedInstallers,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      estimatedHours: projectType !== 'transport' && estimatedHours ? parseFloat(estimatedHours) : undefined,
      isFlexOrder,
      worksWeekends,
      travelBefore: projectType !== 'transport' && travelBefore,
      travelAfter: projectType !== 'transport' && travelAfter,
      description: description || undefined,
      ...(projectType === 'transport' && {
        transportStops: transportStops.filter(s => s.address.trim()),
        vehicleType: vehicleType || undefined,
        goodsItems: goodsItems.filter(g => g.description || g.quantity || g.lengthCm || g.weightKg),
      }),
    };

    onCreateOrder(project);
    void persistBookings(project);
    resetForm();
    onOpenChange(false);
  };

  const toggleInstaller = (id: string) => {
    const alreadySelected = selectedInstallers.includes(id);
    if (!alreadySelected) {
      const blockers = conflictsFor(id).filter(c => c.severity === 'blocking');
      if (blockers.length > 0) {
        toast.error('Double booking prevented', { description: blockers[0].detail });
        return;
      }
    }
    setSelectedInstallers(prev =>
      alreadySelected ? prev.filter(i => i !== id) : [...prev, id]
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

  const selectTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = getTemplate(id);
    if (tpl) setProjectType(tpl.projectType);
  };

  const fieldValues: Record<TemplateFieldId, boolean> = {
    name: !!name.trim(),
    client: !!clientRef,
    projectNumber: !!projectNumber.trim(),
    location: !!(projectType === 'transport' ? transportStops[0]?.address?.trim() : location.trim()),
    startDate: !!startDate,
    endDate: !!endDate,
    estimatedHours: !!estimatedHours.trim(),
    description: !!description.trim(),
  };
  const requiredFields: TemplateFieldId[] = ['name', 'client', 'startDate', 'endDate'];
  const missingFields = requiredFields.filter(f => !fieldValues[f]);

  const dateRangeError = projectDateRangeError(
    startDate ? format(startDate, 'yyyy-MM-dd') : null,
    endDate ? format(endDate, 'yyyy-MM-dd') : null,
  );

  const isValid =
    name.trim() && !!clientRef && startDate && endDate && !dateRangeError && missingFields.length === 0;

  const typeButtons: { value: ProjectType; icon: string }[] = [
    { value: 'installation', icon: '🔧' },
    { value: 'site-survey', icon: '📋' },
    { value: 'transport', icon: '🚛' },
  ];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg font-semibold">Skapa uppdrag</DialogTitle>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{projectId}</span>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            {([['installation','🔧 Montage'],['transport','🚛 Transport']] as const).map(([v,l]) => (
              <button key={v} type="button" onClick={() => { setProjectType(v); setTemplateId(v === 'transport' ? (PROJECT_TEMPLATES.find(t => t.projectType === 'transport')?.id ?? DEFAULT_TEMPLATE_ID) : DEFAULT_TEMPLATE_ID); }}
                className={cn("rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  projectType === v ? "border-primary bg-primary/10 text-primary" : "border-input bg-background text-muted-foreground hover:bg-accent")}>{l}</button>
            ))}
          </div>

          {/* Project Name & PO Number */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="order-name">Uppdragsnamn *</Label>
              <Input id="order-name" placeholder="t.ex. Scandic Gävle – montage" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="order-number">PO-nummer</Label>
              <Input id="order-number" placeholder="Kundens ordernummer" value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} />
            </div>
          </div>

          {/* Client (autocomplete) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 relative" ref={clientInputRef}>
              <Label htmlFor="order-client">Kund *</Label>
              <Input
                id="order-client"
                placeholder="Sök i kundregistret…"
                value={client}
                onChange={(e) => handleClientChange(e.target.value)}
                onFocus={() => handleClientChange(client)}
                onKeyDown={handleClientKeyDown}
                autoComplete="off"
                aria-invalid={!!client.trim() && !clientRef}
              />
              {!clientRef && (
                <p className="text-xs text-muted-foreground">
                  {client.trim()
                    ? 'Pick the customer from the register — free text is not linked to a customer.'
                    : 'Välj en kund från registret.'}
                </p>
              )}
              {showClientSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-border rounded-md bg-popover shadow-md max-h-[140px] overflow-y-auto">
                  {clientSuggestions.map((c, idx) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm transition-colors",
                        idx === highlightedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                      )}
                      onClick={() => selectClient(c)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      {c.name}
                      {clientLabel(c) && (
                        <span className="block text-xs text-muted-foreground">{clientLabel(c)}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location — only for non-transport */}
            {projectType !== 'transport' && (
              <div className="grid gap-1.5">
                <Label htmlFor="order-location">Adress</Label>
                <AddressAutocomplete
                  id="order-location"
                  value={location}
                  onChange={(v) => { setLocation(v); setLocationCoords(null); if (!countryManual) { setCountry(countryFromText(`${name} ${v}`)); setCountryProvenance('DERIVED'); } }}
                  onSelect={(p) => { setLocationCoords(p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null); if (!countryManual) { setCountry(countryFromCode(p.countryCode)); setCountryProvenance(p.countryCode ? 'DERIVED' : 'UNKNOWN'); } }}
                />
                <Label className="mt-2">Land (styr traktamente)</Label>
                <SearchSelect value={country ?? 'Sverige'} onChange={v => { setCountry(v || 'Sverige'); setCountryManual(true); setCountryProvenance(v ? 'CONFIRMED' : 'DEFAULTED'); }} placeholder="Sverige"
                  options={countries.map(c => ({ value: c, label: c }))} />
              </div>
            )}

            {/* Vehicle type — transport only */}
            {projectType === 'transport' && (
              <div className="grid gap-1.5">
                <Label htmlFor="vehicle-type">Fordonstyp</Label>
                <Input id="vehicle-type" placeholder="t.ex. skåpbil, lastbil" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
              </div>
            )}
          </div>

          {/* Dates & Times */}
          {projectType === 'transport' && (
            <div className="grid grid-cols-1 gap-3">
              <div className="grid gap-1.5">
                <Label>Datum och tid *</Label>
                <div className="grid grid-cols-4 gap-3">
                  <div className="grid gap-1.5">
                    <Popover open={startOpen} onOpenChange={setStartOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal text-xs px-2", !startDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          {startDate ? format(startDate, 'MMM d') : 'Välj'}
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
                          {endDate ? format(endDate, 'MMM d') : 'Välj'}
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
                <Label>Start *</Label>
                <Popover open={startOpen} onOpenChange={setStartOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal text-xs px-2", !startDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {startDate ? format(startDate, 'MMM d') : 'Välj'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={(date) => { setStartDate(date); setStartOpen(false); }} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1.5">
                <Label>Starttid</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="text-xs px-2" />
              </div>
              <div className="grid gap-1.5">
                <Label>Slut *</Label>
                <Popover open={endOpen} onOpenChange={setEndOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal text-xs px-2", !endDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-1 h-3 w-3" />
                      {endDate ? format(endDate, 'MMM d') : 'Välj'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={(date) => { setEndDate(date); setEndOpen(false); }} disabled={(date) => startDate ? date < startDate : false} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-1.5">
                <Label>Sluttid</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="text-xs px-2" />
              </div>
            </div>
          )}

          {dateRangeError && (
            <p className="text-xs text-destructive">{dateRangeError}</p>
          )}

          {/* Estimated hours & Flex order */}
          <div className="grid gap-3">
            {projectType !== 'transport' && (
              <div className="grid gap-1.5">
                <Label htmlFor="est-hours">Uppskattade timmar</Label>
                <Input id="est-hours" type="number" min="0" step="0.5" placeholder="t.ex. 8" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
                <p className="text-xs text-muted-foreground">Totalt för hela uppdraget, delas av alla tilldelade tekniker.</p>
              </div>
            )}
          </div>

<label className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
                <Switch checked={worksWeekends} onCheckedChange={setWorksWeekends} />
                <span><span className="text-sm font-semibold">Arbete pågår över helg (lör–sön)</span>
                <span className="block text-xs text-muted-foreground">Av: helgdagar planeras inte och kräver ingen tid.</span></span>
              </label>

          {projectType !== 'transport' && <TravelDayToggles before={travelBefore} after={travelAfter} onBefore={setTravelBefore} onAfter={setTravelAfter}
            startDate={startDate ? format(startDate, 'yyyy-MM-dd') : undefined} endDate={endDate ? format(endDate, 'yyyy-MM-dd') : undefined} />}

          {/* Transport Stops */}
          {projectType === 'transport' && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Stopp på rutten</Label>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={addStop}>
                  <Plus className="h-3 w-3" /> Lägg till stopp
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
                          <AddressAutocomplete
                            className="flex-1"
                            inputClassName="h-8 text-xs pl-7"
                            placeholder="Address..."
                            value={stop.address}
                            onChange={(v) => updateStop(stop.id, { address: v })}
                            onSelect={(p) => updateStop(stop.id, { address: p.address })}
                          />
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
                        {stop.address.trim() && (
                          <MiniMap address={stop.address} height={90} showLink={false} />
                        )}
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
            <Label>{projectType === 'transport' ? 'Tilldela förare' : 'Tilldela tekniker'}</Label>
            <RecommendedInstallers
              recommendations={recommendations}
              selectedIds={selectedInstallers}
              onSelect={toggleInstaller}
            />
            <div className="border border-input rounded-md p-3 grid gap-2 max-h-[180px] overflow-y-auto">
              <TooltipProvider>
                {installers
                  .map(inst => ({ inst, suit: getInstallerSuitability(inst), blocked: conflictsFor(inst.id).some(c => c.severity === 'blocking'), rec: recommendationFor(inst.id) }))
                  .sort((a, b) => (b.rec?.score ?? b.suit?.score ?? 50) - (a.rec?.score ?? a.suit?.score ?? 50))
                  .map(({ inst, suit, blocked, rec }) => (
                  <label key={inst.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent rounded px-1 py-0.5 transition-colors">
                    <Checkbox checked={selectedInstallers.includes(inst.id)} onCheckedChange={() => toggleInstaller(inst.id)} disabled={suit?.score === 0 || (blocked && !selectedInstallers.includes(inst.id))} />
                    <span className={cn((suit?.score === 0 || blocked) && "line-through text-muted-foreground")}>{inst.name}</span>
                    {rec?.recommended && (
                      <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
                        <Sparkles className="h-3 w-3" />#{rec.rank}
                      </span>
                    )}
                    {blocked && <span className="text-[10px] font-medium text-destructive">Konflikt</span>}
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
                    <span className="text-xs text-muted-foreground ml-auto">{inst.type === 'sub-vendor' ? 'UE' : 'Egen'}</span>
                  </label>
                ))}
              </TooltipProvider>
            </div>
            {conflictDraft && selectedInstallers.length > 0 && (
              <ConflictPanel conflicts={conflicts} className="mt-1" />
            )}
            {bookingConflicts.length > 0 && (
              <div className="mt-1 rounded border border-destructive/30 bg-destructive/5 p-2 space-y-1">
                <p className="text-xs font-medium text-destructive">Bokningskonflikter</p>
                {bookingConflicts.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {installers.find(inst => inst.id === c.installerId)?.name ?? 'Installer'} — {c.detail}
                    {' '}({c.from.slice(0, 10)} → {c.to.slice(0, 10)})
                  </p>
                ))}
              </div>
            )}
          </div>

          <details className="group rounded-md border border-border">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Fler alternativ</summary>
            <div className="grid gap-4 px-3 pb-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isFlexOrder} onCheckedChange={(checked) => setIsFlexOrder(!!checked)} />
            <span className="text-sm">Flexuppdrag</span>
            <span className="text-xs text-muted-foreground">Flexibelt inom perioden</span>
          </label>
          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="order-desc">Beskrivning</Label>
            <Textarea id="order-desc" placeholder="Valfria anteckningar…" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          {/* Attachments */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                Bilagor
              </Label>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-3 w-3" /> Lägg till filer
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
                <span className="text-xs">Släpp filer eller klicka för att bifoga</span>
                <span className="text-[10px]">Bilder, PDF, dokument</span>
              </button>
            )}
          </div>
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>Avbryt</Button>
          <Button onClick={handleSubmit} disabled={!isValid || hasBlocking(conflicts)}>
            {hasBlocking(conflicts) ? 'Lös konflikter först' : 'Skapa uppdrag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <BookingOverrideDialog
        open={overrideOpen}
        onOpenChange={(o) => { setOverrideOpen(o); if (!o) setPendingProject(null); }}
        conflicts={bookingConflicts}
        installerName={(id) => installers.find(i => i.id === id)?.name ?? 'Installer'}
        onConfirm={(reason) => { if (pendingProject) void persistBookings(pendingProject, reason); }}
      />
    </>
  );
};

export default CreateOrderDialog;
