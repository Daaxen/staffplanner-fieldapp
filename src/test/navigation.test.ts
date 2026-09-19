import { describe, expect, it } from 'vitest';
import {
  allNavigationViews,
  canAccessNavigationView,
  canonicalViewPath,
  legacyViewPaths,
  navigationForRoles,
} from '@/lib/navigation';

describe('workflow navigation', () => {
  it('keeps every existing destination in the grouped menu', () => {
    expect(allNavigationViews).toEqual(expect.arrayContaining([
      'dashboard', 'operations', 'planner', 'orders', 'clients', 'customer360', 'fleet',
      'documents', 'installer-preview', 'reports', 'executive', 'deviations', 'profitability',
      'invoice-prep', 'resources', 'variance', 'portal', 'invoicing', 'escalations', 'users', 'audit',
    ]));
  });

  it('shows all workflow groups to admins', () => {
    expect(navigationForRoles(['admin']).map(group => group.id)).toEqual([
      'dashboard', 'orders', 'planning', 'field-operations', 'finance', 'customers', 'resources', 'reports', 'administration',
    ]);
  });

  it('hides finance and commercial customer screens from HR', () => {
    expect(canAccessNavigationView('planner', ['hr'])).toBe(true);
    expect(canAccessNavigationView('users', ['hr'])).toBe(true);
    expect(canAccessNavigationView('invoice-prep', ['hr'])).toBe(false);
    expect(canAccessNavigationView('clients', ['hr'])).toBe(false);
  });

  it('does not expose the desktop workflow menu to installer-only users', () => {
    expect(navigationForRoles(['installer'])).toEqual([]);
  });

  it('maps legacy destinations to stable app URLs', () => {
    expect(canonicalViewPath('planner')).toBe('/app/planner');
    expect(legacyViewPaths['/planner']).toBe('/app/planner');
    expect(legacyViewPaths['/invoice-prep']).toBe('/app/invoice-prep');
  });
});