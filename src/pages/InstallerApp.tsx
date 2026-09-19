import { useState, useMemo, useEffect } from 'react';
import { AlertTriangle, Bell, BookOpen, CalendarDays, CheckCircle2, ChevronRight, ClipboardPenLine, FolderKanban, HardHat, LogOut, MessageSquarePlus, MoreHorizontal, Package, User } from 'lucide-react';
import FeedbackModule from '@/components/feedback/FeedbackModule';
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
import { Button } from '@/components/ui/button';

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
  const [projectEntryTab, setProjectEntryTab] = useState<'info' | 'report' | 'log' | 'deviation' | 'summary'>('info');
  const [moreView, setMoreView] = useState<'menu' | 'schedule' | 'orderbox' | 'reminders' | 'docs' | 'feedback' | 'profile'>('menu');
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

  const handleViewOrderDetail = (project: Project, initialTab: typeof projectEntryTab = 'info') => {
    setProjectEntryTab(initialTab);
    setSelectedProject(project);
  };

  const openProjectWorkflow = (project: Project, initialTab: typeof projectEntryTab) => {
    handleViewOrderDetail(project, initialTab);
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
        initialTab={projectEntryTab}
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
        onClick={() => { setMoreView('reminders'); setTab('more'); }}
      />

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="shrink-0 order-last w-full rounded-none border-t border-border bg-card h-16 p-0 grid grid-cols-5 gap-0">
          <TabsTrigger value="schedule" className="rounded-none data-[state=active]:bg-muted data-[state=active]:shadow-none text-[10px] h-full gap-1 flex-col">
            <FolderKanban className="w-3.5 h-3.5" />
            Active jobs
          </TabsTrigger>
          <TabsTrigger value="reporting" className="rounded-none data-[state=active]:bg-muted data-[state=active]:shadow-none text-[10px] h-full gap-1 flex-col">
            <ClipboardPenLine className="w-4 h-4" />
            Reporting
          </TabsTrigger>
          <TabsTrigger value="deviations" className="rounded-none data-[state=active]:bg-muted data-[state=active]:shadow-none text-[10px] h-full gap-1 flex-col">
            <AlertTriangle className="w-4 h-4" />
            Deviations
          </TabsTrigger>
          <TabsTrigger value="signoff" className="rounded-none data-[state=active]:bg-muted data-[state=active]:shadow-none text-[10px] h-full gap-1 flex-col">
            <CheckCircle2 className="w-4 h-4" />
            Sign-off
          </TabsTrigger>
          <TabsTrigger value="more" className="rounded-none data-[state=active]:bg-muted data-[state=active]:shadow-none text-[10px] h-full gap-1 flex-col">
            <MoreHorizontal className="w-4 h-4" />
            More
          </TabsTrigger>
        </TabsList>


        <TabsContent value="schedule" className="flex-1 overflow-auto mt-0">
          <ScheduleFilters filters={projectFilters} onChange={setProjectFilters} />
          <div className="p-4 space-y-3 pb-20">
            <h2 className="text-base font-semibold text-foreground">Active jobs ({activeProjects.length})</h2>
            {activeProjects.map(project => (
              <ProjectCard key={project.id} project={project} onSelect={project => openProjectWorkflow(project, 'info')} currentInstallerId={installer.id} actual={logs.actualFor(project.id)} />
            ))}
            {activeProjects.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No active jobs.</p>}
            {completedProjects.length > 0 && <h2 className="text-sm font-semibold text-muted-foreground pt-2">Recently completed</h2>}
            {completedProjects.map(project => (
              <ProjectCard key={project.id} project={project} onSelect={project => openProjectWorkflow(project, 'info')} currentInstallerId={installer.id} actual={logs.actualFor(project.id)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reporting" className="flex-1 overflow-auto mt-0">
          <LogsOverview logs={logs} projects={myProjects} />
          <div className="px-4 pb-20 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Report on a job</h2>
            {activeProjects.map(project => (
              <ProjectCard key={project.id} project={project} onSelect={project => openProjectWorkflow(project, 'log')} currentInstallerId={installer.id} actual={logs.actualFor(project.id)} />
            ))}
            {activeProjects.length === 0 && <p className="text-sm text-muted-foreground py-3">No active jobs to report on.</p>}
          </div>
        </TabsContent>

        <TabsContent value="deviations" className="flex-1 overflow-auto mt-0">
          <div className="p-4 space-y-3 pb-20">
            <h2 className="text-base font-semibold text-foreground">Choose job to report deviation</h2>
            {activeProjects.map(project => (
              <ProjectCard key={project.id} project={project} onSelect={project => openProjectWorkflow(project, 'deviation')} currentInstallerId={installer.id} />
            ))}
            {activeProjects.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No active jobs.</p>}
          </div>
        </TabsContent>

        <TabsContent value="signoff" className="flex-1 overflow-auto mt-0">
          <div className="p-4 space-y-3 pb-20">
            <h2 className="text-base font-semibold text-foreground">Jobs awaiting sign-off</h2>
            {activeProjects.map(project => (
              <ProjectCard key={project.id} project={project} onSelect={project => openProjectWorkflow(project, 'summary')} currentInstallerId={installer.id} />
            ))}
            {activeProjects.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">No jobs awaiting sign-off.</p>}
          </div>
        </TabsContent>

        <TabsContent value="more" className="flex-1 overflow-auto mt-0">
          {moreView === 'menu' && (
            <div className="p-4 grid grid-cols-2 gap-3 pb-20">
              {[
                { id: 'schedule' as const, label: 'Full schedule', icon: CalendarDays },
                { id: 'orderbox' as const, label: 'Available jobs', icon: Package, badge: availableOrderCount },
                { id: 'reminders' as const, label: 'Inbox', icon: Bell, badge: reminders.reminders.length },
                { id: 'docs' as const, label: 'Documents', icon: BookOpen },
                { id: 'feedback' as const, label: 'Feedback', icon: MessageSquarePlus },
                { id: 'profile' as const, label: 'Profile', icon: User },
              ].map(item => (
                <button key={item.id} onClick={() => setMoreView(item.id)} className="min-h-24 rounded-md border border-border bg-card p-4 text-left flex flex-col justify-between">
                  <div className="flex items-center justify-between"><item.icon className="w-5 h-5 text-primary" />{item.badge ? <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5">{item.badge}</span> : null}</div>
                  <span className="text-sm font-semibold text-foreground flex items-center justify-between">{item.label}<ChevronRight className="w-4 h-4 text-muted-foreground" /></span>
                </button>
              ))}
              <Button variant="outline" className="col-span-2 h-12" onClick={() => toggleTechnicianMode(true)}><HardHat className="w-4 h-4 mr-2" />Field mode</Button>
              <Button variant="ghost" className="col-span-2 h-12 text-destructive" onClick={signOut}><LogOut className="w-4 h-4 mr-2" />Sign out</Button>
            </div>
          )}
          {moreView !== 'menu' && (
            <div className="min-h-full flex flex-col">
              <div className="shrink-0 border-b border-border p-3"><Button variant="ghost" size="sm" onClick={() => setMoreView('menu')}>← More</Button></div>
              <div className="flex-1 overflow-auto">
                {moreView === 'schedule' && <InstallerSchedule projects={myProjects} installer={installer} onSelectProject={project => openProjectWorkflow(project, 'info')} />}
                {moreView === 'orderbox' && <div className="p-4"><InstallerOrderBox projects={localProjects} onPickUp={handlePickUp} onViewDetail={project => handleViewOrderDetail(project)} /></div>}
                {moreView === 'reminders' && <RemindersInbox state={reminders} />}
                {moreView === 'docs' && <InstallerDocuments />}
                {moreView === 'feedback' && <FeedbackModule view="installer" compact />}
                {moreView === 'profile' && <InstallerProfile installer={installer} projectCount={myProjects.length} />}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
};

export default InstallerApp;
