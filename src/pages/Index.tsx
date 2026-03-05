import { useState } from 'react';
import AppSidebar from '@/components/AppSidebar';
import GanttChart from '@/components/GanttChart';
import StatsBar from '@/components/StatsBar';

const Index = () => {
  const [activeView, setActiveView] = useState('planner');

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <StatsBar />
        <GanttChart />
      </main>
    </div>
  );
};

export default Index;
