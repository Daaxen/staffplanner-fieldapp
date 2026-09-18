import { Calendar, Users, LayoutDashboard, ClipboardList, FileText, Settings, PanelLeftClose, PanelLeft, Car, Smartphone, BookOpen, UserCog, LogOut, User as UserIcon, Flame, Building2, Receipt, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { installers } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { useReminders } from '@/hooks/useReminders';

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const baseNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'operations', label: 'Operations', icon: Activity },
  { id: 'planner', label: 'Planner', icon: Calendar },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'customer360', label: 'Customer 360', icon: Users },
  { id: 'fleet', label: 'Fleet', icon: Car },
  { id: 'documents', label: 'Documents', icon: BookOpen },
  { id: 'installer-preview', label: 'Installer View', icon: Smartphone },
  { id: 'reports', label: 'Reports', icon: FileText },
];


const installerColorMap: Record<number, string> = {
  1: 'bg-installer-1',
  2: 'bg-installer-2',
  3: 'bg-installer-3',
  4: 'bg-installer-4',
  5: 'bg-installer-5',
  6: 'bg-installer-6',
};

const AppSidebar = ({ activeView, onViewChange, collapsed = false, onToggleCollapse }: AppSidebarProps) => {
  const { isAdmin, signOut, user } = useAuth();
  const { escalated } = useReminders({ adminScope: true });
  const navItems = [
    ...baseNavItems,
    ...(isAdmin ? [{ id: 'executive', label: 'Executive', icon: TrendingUp }] : []),
    ...(isAdmin ? [{ id: 'deviations', label: 'Deviations', icon: AlertTriangle }] : []),
    ...(isAdmin ? [{ id: 'profitability', label: 'Profitability', icon: TrendingUp }] : []),
    ...(isAdmin ? [{ id: 'invoicing', label: 'Invoicing', icon: Receipt }] : []),
    ...(isAdmin ? [{ id: 'escalations', label: 'Escalations', icon: Flame, badge: escalated.length }] : []),
    ...(isAdmin ? [{ id: 'users', label: 'Users', icon: UserCog }] : []),
    { id: 'profile', label: 'My Profile', icon: UserIcon },
  ] as Array<{ id: string; label: string; icon: typeof Flame; badge?: number }>;
  return (
    <aside className={cn(
      "bg-sidebar text-sidebar-foreground flex flex-col h-screen shrink-0 transition-all duration-200",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className={cn("border-b border-sidebar-border flex items-center", collapsed ? "p-2 justify-center" : "p-4 gap-3")}>
        {!collapsed && (
          <div className="w-9 h-9 rounded-lg bg-sidebar-ring flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-sidebar-primary" />
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-sidebar-primary">StaffPlanner</h1>
            <p className="text-xs text-sidebar-foreground/60">Retail Installations</p>
          </div>
        )}
        {onToggleCollapse && (
          <button onClick={onToggleCollapse} className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors shrink-0">
            {collapsed ? <PanelLeft className="w-5 h-5 text-sidebar-foreground/60" /> : <PanelLeftClose className="w-4 h-4 text-sidebar-foreground/60" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-hidden">
        {!collapsed && <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider mb-3 px-3">Menu</p>}
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            title={collapsed ? item.label : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              collapsed && "justify-center",
              activeView === item.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
            {!collapsed && item.badge ? (
              <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">{item.badge}</span>
            ) : null}
          </button>
        ))}

        {/* Installers */}
        {!collapsed && (
          <div className="mt-8">
            <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider mb-3 px-3">Installers</p>
            <div className="space-y-1">
              {installers.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/30 transition-colors cursor-pointer"
                >
                  <div className={cn("w-2.5 h-2.5 rounded-full", installerColorMap[inst.color])} />
                  <span className="truncate">{inst.name}</span>
                  {inst.type === 'sub-vendor' && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sidebar-border text-sidebar-foreground/50">SUB</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {!collapsed && user && (
          <p className="px-3 py-1 text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
        )}
        <button onClick={signOut} className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors",
          collapsed && "justify-center"
        )}>
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
