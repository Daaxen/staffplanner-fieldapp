import { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, MapPin, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { installers, clients, type Project, type ProjectStatus } from '@/data/mockData';
import { Checkbox } from '@/components/ui/checkbox';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOrder: (project: Project) => void;
}

const generateProjectId = () => {
  const seq = Math.floor(Math.random() * 90000) + 10000;
  return `P-${seq}`;
};

const CreateOrderDialog = ({ open, onOpenChange, onCreateOrder }: CreateOrderDialogProps) => {
  const projectId = useMemo(() => generateProjectId(), [open]);
  const [name, setName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [client, setClient] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
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

  const resetForm = () => {
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
  };

  // Close client suggestions on outside click
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
    if (value.trim()) {
      const filtered = clients.filter(c => c.toLowerCase().includes(value.toLowerCase()));
      setClientSuggestions(filtered);
      setShowClientSuggestions(filtered.length > 0);
    } else {
      setShowClientSuggestions(false);
    }
  };

  const selectClient = (c: string) => {
    setClient(c);
    setShowClientSuggestions(false);
  };

  const handleSubmit = () => {
    if (!name || !client || !startDate || !endDate) return;

    const status: ProjectStatus = selectedInstallers.length > 0 ? 'scheduled' : 'open';

    const project: Project = {
      id: projectId,
      name,
      projectNumber: projectNumber || undefined,
      client,
      location,
      status,
      assigneeIds: selectedInstallers,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      isFlexOrder,
      description: description || undefined,
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

  const isValid = name.trim() && client.trim() && startDate && endDate && startDate <= endDate;

  const mapQuery = location.trim() ? encodeURIComponent(location) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg font-semibold">New Project</DialogTitle>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">{projectId}</span>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
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

          {/* Client (autocomplete) & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5 relative" ref={clientInputRef}>
              <Label htmlFor="order-client">Client *</Label>
              <Input
                id="order-client"
                placeholder="Start typing..."
                value={client}
                onChange={(e) => handleClientChange(e.target.value)}
                onFocus={() => { if (client.trim()) handleClientChange(client); }}
                autoComplete="off"
              />
              {showClientSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 border border-border rounded-md bg-popover shadow-md max-h-[140px] overflow-y-auto">
                  {clientSuggestions.map(c => (
                    <button
                      key={c}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onClick={() => selectClient(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="order-location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="order-location"
                  placeholder="Search address..."
                  className="pl-8"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Mini Map */}
          {location.trim() && (
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

          {/* Estimated hours & Flex order */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="est-hours">Estimated Hours</Label>
              <Input
                id="est-hours"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 8"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>&nbsp;</Label>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <Checkbox checked={isFlexOrder} onCheckedChange={(checked) => setIsFlexOrder(!!checked)} />
                <span className="text-sm">Flex Order</span>
                <span className="text-xs text-muted-foreground">↔ Flexible within period</span>
              </label>
            </div>
          </div>

          {/* Assign Installers */}
          <div className="grid gap-1.5">
            <Label>Assign Installers</Label>
            <div className="border border-input rounded-md p-3 grid gap-2 max-h-[140px] overflow-y-auto">
              {installers.map((inst) => (
                <label key={inst.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent rounded px-1 py-0.5 transition-colors">
                  <Checkbox checked={selectedInstallers.includes(inst.id)} onCheckedChange={() => toggleInstaller(inst.id)} />
                  <span>{inst.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{inst.type === 'sub-vendor' ? 'Sub-vendor' : 'Own'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="order-desc">Description</Label>
            <Textarea id="order-desc" placeholder="Optional notes..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
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
