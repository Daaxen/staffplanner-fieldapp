import { useState } from 'react';
import { Calendar, ClipboardList, User } from 'lucide-react';
import InstallerSchedule from '@/components/installer/InstallerSchedule';
import InstallerProjectDetail from '@/components/installer/InstallerProjectDetail';
import InstallerProfile from '@/components/installer/InstallerProfile';
import { installers, projects as mockProjects, type Project } from '@/data/mockData';

type Tab = 'schedule' | 'projects' | 'profile';

// For now, simulate being logged in as inst-1 (Erik Lindberg)
const CURRENT_INSTALLER_ID = 'inst-1';

const InstallerApp = () => {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const installer = installers.find(i => i.id === CURRENT_INSTALLER_ID)!;
  const myProjects = mockProjects.filter(p => p.assigneeIds.includes(CURRENT_INSTALLER_ID));

  if (selectedProject) {
    return (
      <InstallerProjectDetail
        project={selectedProject}
        installer={installer}
        onBack={() => setSelectedProject(null)}
      />
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-5 h-5" /> },
    { id: 'projects', label: 'Projects', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Installer</h1>
          <p className="text-xs opacity-80">{installer.name}</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm font-bold">
          {installer.name.split(' ').map(n => n[0]).join('')}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {activeTab === 'schedule' && (
          <InstallerSchedule
            projects={myProjects}
            installer={installer}
            onSelectProject={setSelectedProject}
          />
        )}
        {activeTab === 'projects' && (
          <InstallerSchedule
            projects={myProjects}
            installer={installer}
            onSelectProject={setSelectedProject}
            listMode
          />
        )}
        {activeTab === 'profile' && (
          <InstallerProfile installer={installer} projectCount={myProjects.length} />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="shrink-0 bg-card border-t border-border flex">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default InstallerApp;
