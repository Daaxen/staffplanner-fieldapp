import { useState, useMemo } from 'react';
import { CalendarDays, Package, FolderKanban, User, BookOpen, Clock, Bell } from 'lucide-react';
import { addDays, startOfWeek, format } from 'date-fns';
import InstallerSchedule from '@/components/installer/InstallerSchedule';
import InstallerProjectDetail from '@/components/installer/InstallerProjectDetail';
import InstallerProfile from '@/components/installer/InstallerProfile';
import InstallerOrderBox from '@/components/installer/schedule/InstallerOrderBox';
import InstallerDocuments from '@/components/installer/InstallerDocuments';
import QuickCreateProject from '@/components/installer/schedule/QuickCreateProject';
import ProjectCard from '@/components/installer/schedule/ProjectCard';
import ScheduleFilters, { type FilterState } from '@/components/installer/schedule/ScheduleFilters';
import LogsOverview from '@/components/installer/logs/LogsOverview';
import RemindersInbox from '@/components/installer/reminders/RemindersInbox';
import ReminderBanner from '@/components/installer/reminders/ReminderBanner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { installers, projects as mockProjects, type Project } from '@/data/mockData';
import { useInstallerLogs } from '@/hooks/useInstallerLogs';
import { useReminders } from '@/hooks/useReminders';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { toast } from 'sonner';


const CURRENT_INSTALLER_ID = 'inst-1';

const InstallerApp = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [localProjects, setLocalProjects] = useState<Project[]>(mockProjects);
  const [projectFilters, setProjectFilters] = useState<FilterState>({ statuses: [], types: [] });

  const installer = installers.find(i => i.id === CURRENT_INSTALLER_ID)!;
  const myProjects = localProjects.filter(p => p.assigneeIds.includes(CURRENT_INSTALLER_ID));
  const logs = useInstallerLogs(CURRENT_INSTALLER_ID);
  const reminders = useReminders();
  const [tab, setTab] = useState<string>('schedule');
  usePushRegistration(true);


  const availableOrderCount = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const nextWeekEnd = format(addDays(weekStart, 13), 'yyyy-MM-dd');
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    return localProjects.filter(p =>
      p.assigneeIds.length === 0 &&
      p.status !== 'cancelled' &&
      p.startDate <= nextWeekEnd &&
      p.endDate >= weekStartStr
    ).length;
  }, [localProjects]);

  const handlePickUp = (project: Project) => {
    setLocalProjects(prev => prev.map(p =>
      p.id === project.id ? { ...p, assigneeIds: [...p.assigneeIds, CURRENT_INSTALLER_ID], status: 'scheduled' as const } : p
    ));
    toast.success(`Picked up: ${project.name}`);
  };

  const handleStatusChange = (projectId: string, newStatus: Project['status']) => {
    setLocalProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, status: newStatus } : p
    ));
    setSelectedProject(prev => prev && prev.id === projectId ? { ...prev, status: newStatus } : prev);
    const label = newStatus === 'in-progress' ? 'Started' : newStatus === 'completed' ? 'Completed' : 'Updated';
    toast.success(`${label} project`);
  };

  const handleCreateProject = (project: Project) => {
    setLocalProjects(prev => [...prev, project]);
  };

  const handleViewOrderDetail = (project: Project) => {
    setSelectedProject(project);
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

  if (selectedProject) {
    return (
      <InstallerProjectDetail
        project={selectedProject}
        installer={installer}
        logs={logs}
        onBack={() => setSelectedProject(null)}
        onStatusChange={handleStatusChange}
        onPickUp={selectedProject.assigneeIds.length === 0 ? () => handlePickUp(selectedProject) : undefined}
      />
    );
  }

  const activeProjects = filteredMyProjects.filter(p => p.status !== 'cancelled' && p.status !== 'completed');
  const completedProjects = filteredMyProjects.filter(p => p.status === 'completed');

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="shrink-0 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Installer</h1>
          <p className="text-xs opacity-80">{installer.name}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm font-bold">
          {installer.name.split(' ').map(n => n[0]).join('')}
        </div>
      </header>

      <ReminderBanner
        level={reminders.highestLevel}
        count={reminders.reminders.length}
        onClick={() => setTab('reminders')}
      />

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 w-full rounded-none border-b border-border bg-card h-11 p-0 justify-start gap-0">
          <TabsTrigger value="schedule" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-full gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="orderbox" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-full gap-1.5">
            <Package className="w-3.5 h-3.5" />
            OrderBox
            {availableOrderCount > 0 && (
              <span className="ml-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {availableOrderCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="projects" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-full gap-1.5">
            <FolderKanban className="w-3.5 h-3.5" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-full gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Inbox
            {reminders.reminders.length > 0 && (
              <span className="ml-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {reminders.reminders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-full gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Time
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-full gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Docs
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs h-full gap-1.5">
            <User className="w-3.5 h-3.5" />
            Profile
          </TabsTrigger>
        </TabsList>


        <TabsContent value="schedule" className="flex-1 overflow-auto mt-0">
          <InstallerSchedule
            projects={myProjects}
            installer={installer}
            onSelectProject={setSelectedProject}
          />
        </TabsContent>

        <TabsContent value="orderbox" className="flex-1 overflow-auto mt-0">
          <div className="p-4">
            <InstallerOrderBox projects={localProjects} onPickUp={handlePickUp} onViewDetail={handleViewOrderDetail} />
          </div>
        </TabsContent>

        <TabsContent value="projects" className="flex-1 overflow-auto mt-0">
          <ScheduleFilters filters={projectFilters} onChange={setProjectFilters} />
          <div className="p-4 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Active ({activeProjects.length})</h2>
            {activeProjects.map(project => (
              <ProjectCard key={project.id} project={project} onSelect={setSelectedProject} currentInstallerId={installer.id} />
            ))}
            {completedProjects.length > 0 && (
              <>
                <h2 className="text-base font-semibold text-muted-foreground mt-4">Completed ({completedProjects.length})</h2>
                {completedProjects.map(project => (
                  <ProjectCard key={project.id} project={project} onSelect={setSelectedProject} currentInstallerId={installer.id} />
                ))}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="flex-1 overflow-auto mt-0">
          <LogsOverview logs={logs} projects={myProjects} />
        </TabsContent>

        <TabsContent value="docs" className="flex-1 overflow-auto mt-0">
          <InstallerDocuments />
        </TabsContent>

        <TabsContent value="profile" className="flex-1 overflow-auto mt-0">
          <InstallerProfile installer={installer} projectCount={myProjects.length} />
        </TabsContent>
      </Tabs>

      <QuickCreateProject onCreateProject={handleCreateProject} installerId={CURRENT_INSTALLER_ID} />
    </div>
  );
};

export default InstallerApp;
