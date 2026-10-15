import { describe, it, expect } from 'vitest';
import { navigationForRoles } from '@/lib/navigation';

describe('menu sections', () => {
  it('installers see no admin/finance section', () => {
    const groups = navigationForRoles(['installer']);
    expect(groups.some(g => g.section === 'admin')).toBe(false);
    expect(groups.some(g => g.id === 'finance' || g.id === 'administration')).toBe(false);
  });
  it('admins get finance in the admin section', () => {
    const fin = navigationForRoles(['admin']).find(g => g.id === 'finance');
    expect(fin?.section).toBe('admin');
  });
});
