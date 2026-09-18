import { useState, useCallback } from 'react';
import AppSidebar from '@/components/AppSidebar';
import GanttChart from '@/components/GanttChart';
import StatsBar from '@/components/StatsBar';
import FleetManager from '@/components/fleet/FleetManager';
import InstallerPreview from '@/components/installer/InstallerPreview';
import DocumentsManager from '@/components/documents/DocumentsManager';
import UsersManager from '@/components/UsersManager';
import OrdersRegister from '@/components/orders/OrdersRegister';
import ClientsRegister from '@/components/clients/ClientsRegister';
import ProfileEditor from '@/components/ProfileEditor';
import EscalationsView from '@/components/admin/EscalationsView';
import CapacityDashboard from '@/components/dashboard/CapacityDashboard';
import InvoicingView from '@/components/admin/InvoicingView';
import { useProjects } from '@/lib/appData';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Index = () => {
  const [projects] = useProjects();
  const [activeView, setActiveView] = useState('planner');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);

  const handleViewChange = useCallback((view: string) => {
    if (activeView === 'planner' && view !== 'planner' && pendingCount > 0) {
      setPendingNavTarget(view);
      return;
    }
    setActiveView(view);
  }, [activeView, pendingCount]);

  const confirmNavigation = useCallback(() => {
    if (pendingNavTarget) {
      setActiveView(pendingNavTarget);
      setPendingNavTarget(null);
    }
  }, [pendingNavTarget]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeView === 'planner' && (
          <>
            <StatsBar />
            <GanttChart onPendingChangesCount={setPendingCount} />
          </>
        )}
        {activeView === 'dashboard' && (
          <CapacityDashboard />
        )}
        {activeView === 'fleet' && (
          <FleetManager projects={projects} />
        )}
        {activeView === 'installer-preview' && (
          <InstallerPreview projects={projects} />
        )}
        {activeView === 'documents' && (
          <DocumentsManager />
        )}
        {activeView === 'orders' && (
          <OrdersRegister />
        )}
        {activeView === 'clients' && (
          <ClientsRegister />
        )}
        {activeView === 'users' && (
          <UsersManager />
        )}
        {activeView === 'invoicing' && (
          <InvoicingView />
        )}
        {activeView === 'escalations' && (
          <EscalationsView />
        )}
        {activeView === 'profile' && (
          <ProfileEditor />
        )}
        {activeView !== 'planner' && activeView !== 'fleet' && activeView !== 'installer-preview' && activeView !== 'documents' && activeView !== 'users' && activeView !== 'escalations' && activeView !== 'invoicing' && activeView !== 'profile' && activeView !== 'orders' && activeView !== 'clients' && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Module coming soon</p>
          </div>
        )}
      </main>

      <AlertDialog open={!!pendingNavTarget} onOpenChange={(open) => !open && setPendingNavTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undispatched changes</AlertDialogTitle>
            <AlertDialogDescription>
              You still have {pendingCount} project{pendingCount > 1 ? 's' : ''} to dispatch. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigation}>Leave anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;