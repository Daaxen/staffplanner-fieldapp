import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Building2,
  Calendar,
  Car,
  ClipboardList,
  FileText,
  Flame,
  Gauge,
  LayoutDashboard,
  Percent,
  Receipt,
  ScrollText,
  Settings,
  Smartphone,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';

export type AppRole = 'admin' | 'installer' | 'hr';

export interface NavigationItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: AppRole[];
  badge?: 'escalations';
}

export interface NavigationGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  defaultView: string;
  items: NavigationItem[];
}

const admin: AppRole[] = ['admin'];
const adminHr: AppRole[] = ['admin', 'hr'];

export const navigationGroups: NavigationGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    defaultView: 'operations',
    items: [
      { id: 'operations', label: 'Operations overview', icon: Activity, roles: adminHr },
      { id: 'dashboard', label: 'Capacity overview', icon: Gauge, roles: adminHr },
      { id: 'executive', label: 'Executive overview', icon: TrendingUp, roles: admin },
      { id: 'escalations', label: 'Alerts', icon: Flame, roles: adminHr, badge: 'escalations' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders/Projects',
    icon: ClipboardList,
    defaultView: 'orders',
    items: [
      { id: 'orders', label: 'Work orders', icon: ClipboardList, roles: admin },
      { id: 'project-groups', label: 'Projects', icon: FolderKanban, roles: admin },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: Calendar,
    defaultView: 'planner',
    items: [
      { id: 'planner', label: 'Planning board', icon: Calendar, roles: adminHr },
      { id: 'resources', label: 'Resource planning', icon: Gauge, roles: adminHr },
    ],
  },
  {
    id: 'field-operations',
    label: 'Field Operations',
    icon: Smartphone,
    defaultView: 'installer-preview',
    items: [
      { id: 'installer-preview', label: 'Active jobs', icon: Smartphone, roles: admin },
      { id: 'deviations', label: 'Field deviations', icon: AlertTriangle, roles: admin },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Receipt,
    defaultView: 'invoice-prep',
    items: [
      { id: 'invoice-prep', label: 'Invoice preparation', icon: Receipt, roles: admin },
      { id: 'profitability', label: 'Profitability', icon: TrendingUp, roles: admin },
      { id: 'invoicing', label: 'Invoicing & exports', icon: FileText, roles: admin },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Building2,
    defaultView: 'clients',
    items: [
      { id: 'clients', label: 'Customer register', icon: Building2, roles: admin },
      { id: 'customer360', label: 'Customer 360', icon: Users, roles: admin },
      { id: 'portal', label: 'Portal access', icon: UserCog, roles: admin },
    ],
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: Users,
    defaultView: 'users',
    items: [
      { id: 'users', label: 'Installers & users', icon: Users, roles: adminHr },
      { id: 'fleet', label: 'Fleet', icon: Car, roles: adminHr },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    defaultView: 'reports',
    items: [
      { id: 'reports', label: 'Report centre', icon: FileText, roles: adminHr },
      { id: 'variance', label: 'Estimate accuracy', icon: Percent, roles: adminHr },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: Settings,
    defaultView: 'documents',
    items: [
      { id: 'documents', label: 'Document management', icon: BookOpen, roles: adminHr },
      { id: 'audit', label: 'Audit logs', icon: ScrollText, roles: adminHr },
    ],
  },
];

export const allNavigationViews = navigationGroups.flatMap(group => group.items.map(item => item.id));

export const navigationForRoles = (roles: AppRole[]) =>
  navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.some(role => roles.includes(role))),
    }))
    .filter(group => group.items.length > 0);

export const canAccessNavigationView = (view: string, roles: AppRole[]) =>
  navigationForRoles(roles).some(group => group.items.some(item => item.id === view));

export const canonicalViewPath = (view: string) => `/app/${view}`;

export const legacyViewPaths: Record<string, string> = Object.fromEntries(
  allNavigationViews.map(view => [`/${view}`, canonicalViewPath(view)]),
);