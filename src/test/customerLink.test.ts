import { describe, expect, it } from 'vitest';
import type { Client, Project } from '@/data/mockData';
import {
  clientForProject,
  customerFieldInfo,
  matchClientByName,
  projectBelongsToClient,
} from '@/lib/customerLink';

const client = (over: Partial<Client>): Client =>
  ({
    id: 'C-1',
    name: 'Dynamic Places',
    street: 'Storgatan 1',
    postalCode: '111 22',
    region: 'Stockholm',
    mainContact: { name: 'Anna Berg', role: 'Site manager', phone: '070-1234567', email: 'anna@dp.se' },
    rates: { hourlyRate: 850, overtimeRate: 1200, mileageRate: 30, vatPercent: 25 },
    invoicing: { invoiceEmail: 'faktura@dp.se', paymentTermsDays: 30 },
    ...over,
  }) as Client;

const project = (over: Partial<Project>): Project =>
  ({ id: 'P-1', name: 'Rollout', client: 'Dynamic Places', ...over }) as Project;

describe('customer linking', () => {
  const clients = [client({}), client({ id: 'C-2', name: 'Nordic Retail' })];

  it('resolves the customer from the link, not the name', () => {
    const p = project({ clientId: 'C-2', client: 'Dynamic Places' });
    expect(clientForProject(p, clients)?.id).toBe('C-2');
  });

  it('keeps the link when the customer is renamed', () => {
    const renamed = [client({ name: 'Dynamic Places AB' }), clients[1]];
    const p = project({ clientId: 'C-1', client: 'Dynamic Places' });
    expect(projectBelongsToClient(p, renamed[0])).toBe(true);
    expect(clientForProject(p, renamed)?.name).toBe('Dynamic Places AB');
  });

  it('falls back to the name only for unlinked orders', () => {
    const p = project({ client: 'Nordic Retail' });
    expect(clientForProject(p, clients)?.id).toBe('C-2');
  });

  it('never guesses between several customers with the same name', () => {
    const dupes = [client({ id: 'C-3' }), client({ id: 'C-4' })];
    expect(matchClientByName('Dynamic Places', dupes)).toBeNull();
    expect(clientForProject(project({}), dupes)).toBeNull();
  });

  it('matches names case- and space-insensitively', () => {
    expect(matchClientByName('  nordic retail ', clients)?.id).toBe('C-2');
  });

  it('gives field staff address and contact but no commercial data', () => {
    const info = customerFieldInfo(project({ clientId: 'C-1' }), clients);
    expect(info).toEqual({
      name: 'Dynamic Places',
      address: 'Storgatan 1, 111 22 Stockholm',
      region: 'Stockholm',
      contactName: 'Anna Berg',
      contactRole: 'Site manager',
      contactPhone: '070-1234567',
      contactEmail: 'anna@dp.se',
    });
    expect(JSON.stringify(info)).not.toMatch(/850|1200|faktura|vat|Vat/i);
  });
});
