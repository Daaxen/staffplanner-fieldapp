import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { type Project, type ProjectType, projectTypeLabels, clients } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface QuickCreateProjectProps {
  onCreateProject: (project: Project) => void;
  installerId: string;
}

const QuickCreateProject = ({ onCreateProject, installerId }: QuickCreateProjectProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [location, setLocation] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('installation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const reset = () => {
    setName(''); setClient(''); setLocation('');
    setProjectType('installation'); setStartDate(''); setEndDate('');
  };

  const handleCreate = () => {
    if (!name || !client || !location || !startDate || !endDate) {
      toast.error('Please fill in all fields');
      return;
    }
    const id = `proj-${Date.now()}`;
    const project: Project = {
      id,
      name,
      projectType,
      client,
      location,
      status: 'scheduled',
      assigneeIds: [installerId],
      startDate,
      endDate,
    };
    onCreateProject(project);
    toast.success('Project created');
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-50 active:scale-95 transition-transform">
          <Plus className="w-6 h-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[360px] mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Quick Create Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm"
          />
          <Input
            placeholder="Client"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            className="text-sm"
            list="client-suggestions"
          />
          <datalist id="client-suggestions">
            {clients.map(c => <option key={c} value={c} />)}
          </datalist>
          <Input
            placeholder="Location / City"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="text-sm"
          />
          <Select value={projectType} onValueChange={(v) => setProjectType(v as ProjectType)}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['installation', 'site-survey', 'transport'] as ProjectType[]).map(t => (
                <SelectItem key={t} value={t}>{projectTypeLabels[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground font-medium">Start</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-muted-foreground font-medium">End</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm" />
            </div>
          </div>
          <Button onClick={handleCreate} className="w-full" size="lg">
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickCreateProject;
