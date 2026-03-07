import { useState } from 'react';
import { type Installer, type Project, installers, projectTypeIcons, statusLabels } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InstallerSchedule from '@/components/installer/InstallerSchedule';
import InstallerProjectDetail from '@/components/installer/InstallerProjectDetail';
import InstallerProfile from '@/components/installer/InstallerProfile';
import { Calendar, ClipboardList, User, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'schedule' | 'projects' | 'profile';

interface InstallerPreviewProps {
  projects: Project[];
}

const installerColorMap: Record<number, string> = {
  1: 'bg-installer-1',
  2: 'bg-installer-2',
  3: 'bg-installer-3',
  4: 'bg-installer-4',
  5: 'bg-installer-5',
  6: 'bg-installer-6',
};

const InstallerPreview = ({ projects }: InstallerPreviewProps) => {
  const [selectedInstallerId, setSelectedInstallerId] = useState(installers[0].id);
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const installer = installers.find(i => i.id === selectedInstallerId)!;
  const myProjects = projects.filter(p => p.assigneeIds.includes(selectedInstallerId));

  const handlePickUp = (project: Project) => {
    toast.info(`Pick-up action for "${project.name}" — would assign to ${installer.name} in production`);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-6 bg-muted/30 overflow-auto">
      {/* Installer Selector */}
      <div className="w-full max-w-md mb-4 flex items-center gap-3">
        <Smartphone className="w-5 h-5 text-muted-foreground shrink-0" />
        <h2 className="text-sm font-semibold text-foreground shrink-0">Viewing as:</h2>
        <Select value={selectedInstallerId} onValueChange={(v) => { setSelectedInstallerId(v); setSelectedProject(null); }}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {installers.map(inst => (
              <SelectItem key={inst.id} value={inst.id}>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2.5 h-2.5 rounded-full", installerColorMap[inst.color])} />
                  {inst.name}
                  {inst.type === 'sub-vendor' && <span className="text-[10px] text-muted-foreground ml-1">(SUB)</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Phone Frame */}
      <div className="w-[390px] h-[780px] rounded-[2.5rem] border-[8px] border-foreground/80 bg-background shadow-2xl overflow-hidden flex flex-col relative">
        {/* Phone notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/80 rounded-b-2xl z-50" />

        {selectedProject ? (
          <InstallerProjectDetail
            project={selectedProject}
            installer={installer}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <>
            {/* Header */}
            <header className="shrink-0 bg-primary text-primary-foreground px-4 pt-8 pb-3 flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold">Installer</h1>
                <p className="text-[11px] opacity-80">{installer.name}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xs font-bold">
                {installer.name.split(' ').map(n => n[0]).join('')}
              </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto">
              {activeTab === 'schedule' && (
                <InstallerSchedule projects={myProjects} allProjects={projects} installer={installer} onSelectProject={setSelectedProject} onPickUpProject={handlePickUp} />
              )}
              {activeTab === 'projects' && (
                <InstallerSchedule projects={myProjects} allProjects={projects} installer={installer} onSelectProject={setSelectedProject} onPickUpProject={handlePickUp} listMode />
              )}
              {activeTab === 'profile' && (
                <InstallerProfile installer={installer} projectCount={myProjects.length} />
              )}
            </main>

            {/* Bottom Nav */}
            <nav className="shrink-0 bg-card border-t border-border flex">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                    activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </>
        )}
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground mt-3">
        Live preview — {myProjects.length} project{myProjects.length !== 1 ? 's' : ''} assigned
      </p>
    </div>
  );
};

export default InstallerPreview;
