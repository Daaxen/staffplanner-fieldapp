import { useState, useCallback, useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import GanttChart from '@/components/GanttChart';
import StatsBar from '@/components/StatsBar';
import FleetManager from '@/components/fleet/FleetManager';
import InstallerPreview from '@/components/installer/InstallerPreview';
import DocumentsManager from '@/components/documents/DocumentsManager';
import UsersManager from '@/components/UsersManager';
import OrdersRegister from '@/components/orders/OrdersRegister';
import ProjectGroupsRegister from '@/components/projects/ProjectGroupsRegister';
import ClientsRegister from '@/components/clients/ClientsRegister';
import Customer360 from '@/components/clients/Customer360';
import ProfileEditor from '@/components/ProfileEditor';
import EscalationsView from '@/components/admin/EscalationsView';
import CapacityDashboard from '@/components/dashboard/CapacityDashboard';
import OperationsDashboard from '@/components/dashboard/OperationsDashboard';
import ExecutiveDashboard from '@/components/dashboard/ExecutiveDashboard';
import InvoicingView from '@/components/admin/InvoicingView';
import InvoicePrepView from '@/components/admin/InvoicePrepView';
import DeviationsView from '@/components/admin/DeviationsView';
import ProfitabilityView from '@/components/admin/ProfitabilityView';
import ResourcePlanningDashboard from '@/components/dashboard/ResourcePlanningDashboard';
import VarianceAnalysisDashboard from '@/components/dashboard/VarianceAnalysisDashboard';
import PortalUsersManager from '@/components/admin/PortalUsersManager';
import AuditTimeline from '@/components/admin/AuditTimeline';
import FeedbackModule from '@/components/feedback/FeedbackModule';
import { useAuth } from '@/hooks/useAuth';
import { canAccessNavigationView, canonicalViewPath, type AppRole } from '@/lib/navigation';

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
  const { view } = useParams<{ view?: string }>();
  const navigate = useNavigate();
  const { roles, isAdmin, isInstaller, isHr } = useAuth();
  const [projects] = useProjects();
  const defaultView = isAdmin || isHr ? 'operations' : 'planner';
  const requestedView = view ?? defaultView;
  const allowedView = useMemo(
    () => requestedView === 'feedback' || requestedView === 'profile' || canAccessNavigationView(requestedView, roles as AppRole[]),
    [requestedView, roles],
  );
  const activeView = allowedView ? requestedView : defaultView;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);

  const handleViewChange = useCallback((view: string) => {
    if (activeView === 'planner' && view !== 'planner' && pendingCount > 0) {
      setPendingNavTarget(view);
      return;
    }
    navigate(canonicalViewPath(view));
  }, [activeView, navigate, pendingCount]);

  const confirmNavigation = useCallback(() => {
    if (pendingNavTarget) {
      navigate(canonicalViewPath(pendingNavTarget));
      setPendingNavTarget(null);
    }
  }, [navigate, pendingNavTarget]);

  useEffect(() => {
    if (!view && (isAdmin || isHr)) navigate(canonicalViewPath(defaultView), { replace: true });
  }, [defaultView, isAdmin, isHr, navigate, view]);

  if (isInstaller && !isAdmin && !isHr) return <Navigate to="/installer" replace />;
  if (!allowedView && view) return <Navigate to={canonicalViewPath(defaultView)} replace />;

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
        {activeView === 'operations' && (
          <OperationsDashboard />
        )}
        {activeView === 'executive' && (
          <ExecutiveDashboard />
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
        {activeView === 'project-groups' && (
          <ProjectGroupsRegister />
        )}
        {activeView === 'clients' && (
          <ClientsRegister />
        )}
        {activeView === 'customer360' && (
          <Customer360 />
        )}
        {activeView === 'users' && (
          <UsersManager />
        )}
        {activeView === 'profitability' && (
          <ProfitabilityView />
        )}
        {activeView === 'invoicing' && (
          <InvoicingView />
        )}
        {activeView === 'invoice-prep' && (
          <InvoicePrepView />
        )}
        {activeView === 'deviations' && (
          <DeviationsView />
        )}
        {activeView === 'escalations' && (
          <EscalationsView />
        )}
        {activeView === 'profile' && (
          <ProfileEditor />
        )}
        {activeView === 'resources' && (
          <ResourcePlanningDashboard />
        )}
        {activeView === 'variance' && (
          <VarianceAnalysisDashboard />
        )}
        {activeView === 'portal' && (
          <PortalUsersManager />
        )}
        {activeView === 'audit' && (
          <AuditTimeline />
        )}
        {activeView === 'feedback' && (
          <FeedbackModule view="admin" />
        )}
        {activeView === 'reports' && (

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