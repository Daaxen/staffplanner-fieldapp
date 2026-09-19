import { useState, useMemo, useEffect } from 'react';
import { CalendarDays, Package, FolderKanban, User, BookOpen, Clock, Bell, LogOut, HardHat } from 'lucide-react';
import { addDays, startOfWeek, format } from 'date-fns';
import InstallerSchedule from '@/components/installer/InstallerSchedule';
import InstallerProjectDetail from '@/components/installer/InstallerProjectDetail';
import InstallerProfile from '@/components/installer/InstallerProfile';
import TechnicianMode from '@/components/installer/technician/TechnicianMode';
import InstallerOrderBox from '@/components/installer/schedule/InstallerOrderBox';
import InstallerDocuments from '@/components/installer/InstallerDocuments';
import ProjectCard from '@/components/installer/schedule/ProjectCard';
import ScheduleFilters, { type FilterState } from '@/components/installer/schedule/ScheduleFilters';
import LogsOverview from '@/components/installer/reporting/LogsOverview';
import RemindersInbox from '@/components/installer/reminders/RemindersInbox';
import ReminderBanner from '@/components/installer/reminders/ReminderBanner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { type Project } from '@/data/mockData';
import { useProjects, useAppDataLoaded } from '@/lib/appData';
import OfflineBanner from '@/components/installer/OfflineBanner';
import { useCachedProjects, useOfflineSync } from '@/hooks/useOffline';
import { setStatusHandler } from '@/lib/offline/fieldWork';
import { useCurrentInstaller } from '@/hooks/useInstallers';
import { useAuth } from '@/hooks/useAuth';
import { useInstallerLogs } from '@/hooks/useInstallerLogs';
import { useReminders } from '@/hooks/useReminders';
import { usePushRegistration } from '@/hooks/usePushRegistration';
import { toast } from 'sonner';

const InstallerApp = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [liveProjects, setLocalProjects] = useProjects();
  const appDataLoaded = useAppDataLoaded();
  const localProjects = useCachedProjects(liveProjects, appDataLoaded);
  const offline = useOfflineSync();
  const [projectFilters, setProjectFilters] = useState<FilterState>({ statuses: [], types: [] });

  const { installer, loading: installerLoading } = useCurrentInstaller();
  const { signOut } = useAuth();
  const currentInstallerId = installer?.id ?? '';
  const myProjects = localProjects.filter(p => currentInstallerId && p.assigneeIds.includes(currentInstallerId));
  const logs = useInstallerLogs(localProjects);
  const reminders = useReminders();
  const [tab, setTab] = useState<string>('schedule');
  const [technicianMode, setTechnicianMode] = useState<boolean>(
    () => localStorage.getItem('technicianMode') === '1',
  );
  const toggleTechnicianMode = (on: boolean) => {
    setTechnicianMode(on);
    localStorage.setItem('technicianMode', on ? '1' : '0');
  };
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
      p.id === project.id ? { ...p, assigneeIds: [...p.assigneeIds, currentInstallerId], status: 'scheduled' as const } : p
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

  // Replay status changes made while offline once the connection is back.
  useEffect(() => {
    setStatusHandler((projectRef, status) => {
      setLocalProjects(prev => prev.map(p => (p.id === projectRef ? { ...p, status } : p)));
    });
    return () => setStatusHandler(null);
  }, [setLocalProjects]);

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

  if (installerLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        Loading your account…
      </div>
    );
  }

  if (!installer) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">No installer account linked</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          You're signed in, but your account isn't set up as an installer yet. Ask an administrator to give you
          installer access, then sign in again.
        </p>
        <button
          onClick={signOut}
          className="mt-2 text-sm font-medium underline underline-offset-4 text-primary"
        >
          Sign out
        </button>
      </div>
    );
  }

  if (technicianMode) {
    return (
      <TechnicianMode
        projects={localProjects}
        installer={installer}
        onStatusChange={handleStatusChange}
        onExit={() => toggleTechnicianMode(false)}
      />
    );
  }

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleTechnicianMode(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-3 py-2 text-xs font-medium"
          >
            <HardHat className="w-4 h-4" />
            Field mode
          </button>
          <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm font-bold">
            {installer.name.split(' ').map(n => n[0]).join('')}
          </div>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="p-2 rounded-md hover:bg-primary-foreground/15 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <OfflineBanner online={offline.online} pending={offline.pending} syncing={offline.syncing} onSync={offline.sync} />

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
              <ProjectCard key={project.id} project={project} onSelect={setSelectedProject} currentInstallerId={installer.id} actual={logs.actualFor(project.id)} />
            ))}
            {completedProjects.length > 0 && (
              <>
                <h2 className="text-base font-semibold text-muted-foreground mt-4">Completed ({completedProjects.length})</h2>
                {completedProjects.map(project => (
                  <ProjectCard key={project.id} project={project} onSelect={setSelectedProject} currentInstallerId={installer.id} actual={logs.actualFor(project.id)} />
                ))}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reminders" className="flex-1 overflow-auto mt-0">
          <RemindersInbox state={reminders} />
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

    </div>
  );
};

export default InstallerApp;
