import { useState, useMemo } from 'react';
import { type Installer, type Project, installers } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InstallerSchedule from '@/components/installer/InstallerSchedule';
import InstallerProjectDetail from '@/components/installer/InstallerProjectDetail';
import InstallerProfile from '@/components/installer/InstallerProfile';
import InstallerOrderBox from '@/components/installer/schedule/InstallerOrderBox';
import ProjectCard from '@/components/installer/schedule/ProjectCard';
import ScheduleFilters, { type FilterState } from '@/components/installer/schedule/ScheduleFilters';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Package, Smartphone } from 'lucide-react';
import { addDays, startOfWeek, format } from 'date-fns';
import { toast } from 'sonner';
import { useInstallerLogs } from '@/hooks/useInstallerLogs';

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
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectFilters, setProjectFilters] = useState<FilterState>({ statuses: [], types: [] });

  const installer = installers.find(i => i.id === selectedInstallerId)!;
  const myProjects = projects.filter(p => p.assigneeIds.includes(selectedInstallerId));
  const logs = useInstallerLogs(selectedInstallerId);

  const availableOrderCount = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeekEnd = format(addDays(weekStart, 13), 'yyyy-MM-dd');
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    return projects.filter(p =>
      p.assigneeIds.length === 0 &&
      p.status !== 'cancelled' &&
      p.startDate <= nextWeekEnd &&
      p.endDate >= weekStartStr
    ).length;
  }, [projects]);

  const handlePickUp = (project: Project) => {
    toast.info(`Pick-up action for "${project.name}" — would assign to ${installer.name} in production`);
  };

  const filteredMyProjects = useMemo(() => {
    let result = myProjects;
    if (projectFilters.statuses.length > 0) {
      result = result.filter(p => projectFilters.statuses.includes(p.status));
    }
    if (projectFilters.types.length > 0) {
      result = result.filter(p => projectFilters.types.includes(p.projectType));
    }
    return result;
  }, [myProjects, projectFilters]);

  const activeProjects = filteredMyProjects.filter(p => p.status !== 'cancelled' && p.status !== 'completed');
  const completedProjects = filteredMyProjects.filter(p => p.status === 'completed');

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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/80 rounded-b-2xl z-50" />

        {selectedProject ? (
          <InstallerProjectDetail
            project={selectedProject}
            installer={installer}
            logs={logs}
            onBack={() => setSelectedProject(null)}
          />
        ) : (
          <>
            <header className="shrink-0 bg-primary text-primary-foreground px-4 pt-8 pb-3 flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold">Installer</h1>
                <p className="text-[11px] opacity-80">{installer.name}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xs font-bold">
                {installer.name.split(' ').map(n => n[0]).join('')}
              </div>
            </header>

            <Tabs defaultValue="schedule" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="shrink-0 w-full rounded-none border-b border-border bg-card h-9 p-0 justify-start gap-0">
                <TabsTrigger value="schedule" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] h-full">
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="orders" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] h-full gap-1">
                  <Package className="w-3 h-3" />
                  Orders
                  {availableOrderCount > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {availableOrderCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="projects" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] h-full">
                  Projects
                </TabsTrigger>
                <TabsTrigger value="profile" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[10px] h-full">
                  Profile
                </TabsTrigger>
              </TabsList>

              <TabsContent value="schedule" className="flex-1 overflow-auto mt-0">
                <InstallerSchedule projects={myProjects} installer={installer} onSelectProject={setSelectedProject} />
              </TabsContent>

              <TabsContent value="orders" className="flex-1 overflow-auto mt-0">
                <div className="p-3">
                  <InstallerOrderBox projects={projects} onPickUp={handlePickUp} />
                </div>
              </TabsContent>

              <TabsContent value="projects" className="flex-1 overflow-auto mt-0">
                <ScheduleFilters filters={projectFilters} onChange={setProjectFilters} />
                <div className="p-3 space-y-2">
                  <h2 className="text-xs font-semibold text-foreground">Active ({activeProjects.length})</h2>
                  {activeProjects.map(project => (
                    <ProjectCard key={project.id} project={project} onSelect={setSelectedProject} currentInstallerId={selectedInstallerId} />
                  ))}
                  {completedProjects.length > 0 && (
                    <>
                      <h2 className="text-xs font-semibold text-muted-foreground mt-3">Completed ({completedProjects.length})</h2>
                      {completedProjects.map(project => (
                        <ProjectCard key={project.id} project={project} onSelect={setSelectedProject} currentInstallerId={selectedInstallerId} />
                      ))}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="profile" className="flex-1 overflow-auto mt-0">
                <InstallerProfile installer={installer} projectCount={myProjects.length} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Live preview — {myProjects.length} project{myProjects.length !== 1 ? 's' : ''} assigned
      </p>
    </div>
  );
};

export default InstallerPreview;
