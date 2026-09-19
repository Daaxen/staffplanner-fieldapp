import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronDown, LogOut, MessageSquarePlus, PanelLeft, PanelLeftClose, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useReminders } from '@/hooks/useReminders';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { navigationForRoles, type AppRole, type NavigationGroup } from '@/lib/navigation';

interface AppSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const AppSidebar = ({ activeView, onViewChange, collapsed = false, onToggleCollapse }: AppSidebarProps) => {
  const { roles, signOut, user } = useAuth();
  const { escalated } = useReminders({ adminScope: true });
  const groups = useMemo(() => navigationForRoles(roles as AppRole[]), [roles]);
  const activeGroup = groups.find(group => group.items.some(item => item.id === activeView))?.id;
  const [openGroups, setOpenGroups] = useState<string[]>(() => activeGroup ? [activeGroup] : ['dashboard']);

  useEffect(() => {
    if (activeGroup) setOpenGroups(current => current.includes(activeGroup) ? current : [...current, activeGroup]);
  }, [activeGroup]);

  const toggleGroup = (groupId: string, open: boolean) => {
    setOpenGroups(current => open ? [...new Set([...current, groupId])] : current.filter(id => id !== groupId));
  };

  const itemBadge = (badge?: 'escalations') => badge === 'escalations' ? escalated.length : 0;

  const renderCollapsedGroup = (group: NavigationGroup) => {
    const destination = group.items.find(item => item.id === group.defaultView) ?? group.items[0];
    const active = group.items.some(item => item.id === activeView);
    return (
      <button
        key={group.id}
        onClick={() => destination && onViewChange(destination.id)}
        title={group.label}
        aria-label={group.label}
        className={cn(
          'w-full flex items-center justify-center p-2.5 rounded-md transition-colors',
          active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50',
        )}
      >
        <group.icon className="w-4 h-4" />
      </button>
    );
  };

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
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {!collapsed && <p className="text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider mb-2 px-3">Workflows</p>}
        {collapsed ? groups.map(renderCollapsedGroup) : groups.map(group => {
          const open = openGroups.includes(group.id);
          const groupActive = group.items.some(item => item.id === activeView);
          return (
            <Collapsible key={group.id} open={open} onOpenChange={next => toggleGroup(group.id, next)}>
              <CollapsibleTrigger className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold transition-colors',
                groupActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/40',
              )}>
                <group.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-1">
                {group.items.map(item => {
                  const badge = itemBadge(item.badge);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onViewChange(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 pl-10 pr-3 py-2 rounded-md text-[13px] transition-colors',
                        activeView === item.id
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge > 0 && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">{badge}</span>
                      )}
                    </button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <button onClick={() => onViewChange('feedback')} className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50',
          collapsed && 'justify-center', activeView === 'feedback' && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )} title={collapsed ? 'Feedback & Improvements' : undefined}>
          <MessageSquarePlus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Feedback & Improvements</span>}
        </button>
        <button onClick={() => onViewChange('profile')} className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50',
          collapsed && 'justify-center', activeView === 'profile' && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )} title={collapsed ? 'My profile' : undefined}>
          <UserIcon className="w-4 h-4 shrink-0" />
          {!collapsed && <span>My profile</span>}
        </button>
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
