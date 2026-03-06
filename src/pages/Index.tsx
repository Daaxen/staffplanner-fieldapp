import { useState } from 'react';
import AppSidebar from '@/components/AppSidebar';
import GanttChart from '@/components/GanttChart';
import StatsBar from '@/components/StatsBar';
import FleetManager from '@/components/fleet/FleetManager';
import { projects } from '@/data/mockData';

const Index = () => {
  const [activeView, setActiveView] = useState('planner');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeView === 'planner' && (
          <>
            <StatsBar />
            <GanttChart />
          </>
        )}
        {activeView === 'fleet' && (
          <FleetManager projects={projects} />
        )}
        {activeView !== 'planner' && activeView !== 'fleet' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Module coming soon</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
