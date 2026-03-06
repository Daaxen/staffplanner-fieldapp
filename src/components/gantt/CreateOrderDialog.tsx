import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { installers, type Project, type ProjectStatus } from '@/data/mockData';
import { Checkbox } from '@/components/ui/checkbox';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOrder: (project: Project) => void;
}

const generateProjectId = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `P${year}-${seq}`;
};

const CreateOrderDialog = ({ open, onOpenChange, onCreateOrder }: CreateOrderDialogProps) => {
  const [name, setName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedInstallers, setSelectedInstallers] = useState<string[]>([]);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const resetForm = () => {
    setName('');
    setProjectNumber('');
    setClient('');
    setLocation('');
    setDescription('');
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedInstallers([]);
  };

  const handleSubmit = () => {
    if (!name || !client || !startDate || !endDate) return;

    const status: ProjectStatus = selectedInstallers.length > 0 ? 'scheduled' : 'open';

    const generatedId = generateProjectId();
    const project: Project = {
      id: generatedId,
      name,
      projectNumber: projectNumber || generatedId,
      client,
      location,
      status,
      assigneeIds: selectedInstallers,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Create New Order</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Project Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="order-name">Project Name *</Label>
            <Input
              id="order-name"
              placeholder="e.g. IKEA Kitchen Install"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Client & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="order-client">Client *</Label>
              <Input
                id="order-client"
                placeholder="e.g. IKEA"
                value={client}
                onChange={(e) => setClient(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="order-location">Location</Label>
              <Input
                id="order-location"
                placeholder="e.g. Barkarby"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start Date *</Label>
              <Popover open={startOpen} onOpenChange={setStartOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => { setStartDate(date); setStartOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-1.5">
              <Label>End Date *</Label>
              <Popover open={endOpen} onOpenChange={setEndOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => { setEndDate(date); setEndOpen(false); }}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Assign Installers */}
          <div className="grid gap-1.5">
            <Label>Assign Installers</Label>
            <div className="border border-input rounded-md p-3 grid gap-2 max-h-[140px] overflow-y-auto">
              {installers.map((inst) => (
                <label
                  key={inst.id}
                  className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent rounded px-1 py-0.5 transition-colors"
                >
                  <Checkbox
                    checked={selectedInstallers.includes(inst.id)}
                    onCheckedChange={() => toggleInstaller(inst.id)}
                  />
                  <span>{inst.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {inst.type === 'sub-vendor' ? 'Sub-vendor' : 'Own'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="order-desc">Description</Label>
            <Textarea
              id="order-desc"
              placeholder="Optional notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateOrderDialog;
