import type { Client, Project } from '@/data/mockData';

/**
 * Orders are linked to a customer record, not to a typed-in name.
 * `Project.clientId` is the customer reference (clients.ref) and is stored on
 * the order row together with the real database relation (projects.client_id).
 * `Project.client` is kept only as a historical snapshot of the name.
 */

const key = (v?: string | null) => (v ?? '').trim().toLowerCase();

/**
 * The single customer matching a name, or null when there is no match or the
 * name is ambiguous. Ambiguity is never resolved by guessing.
 */
export function matchClientByName(
  name: string | undefined | null,
  clients: Client[],
): Client | null {
  const k = key(name);
  if (!k) return null;
  const hits = clients.filter((c) => key(c.name) === k);
  return hits.length === 1 ? hits[0] : null;
}

/** The customer an order belongs to, resolved by link first, name only as fallback. */
export function clientForProject(project: Project, clients: Client[]): Client | null {
  if (project.clientId) {
    return clients.find((c) => c.id === project.clientId) ?? null;
  }
  return matchClientByName(project.client, clients);
}

/** True when the order belongs to this customer. */
export function projectBelongsToClient(project: Project, client: Client): boolean {
  if (project.clientId) return project.clientId === client.id;
  return !!client.name && key(project.client) === key(client.name);
}

export interface CustomerFieldInfo {
  name: string;
  address: string;
  region?: string;
  contactName?: string;
  contactRole?: string;
  contactPhone?: string;
  contactEmail?: string;
}

/**
 * What field staff may see about the customer: name, address and contact
 * details. Rates, VAT, invoicing and payment terms are never included.
 */
export function customerFieldInfo(
  project: Project,
  clients: Client[],
): CustomerFieldInfo | null {
  const client = clientForProject(project, clients);
  if (!client) return project.client ? { name: project.client, address: '' } : null;
  const address = [client.street, [client.postalCode, client.region].filter(Boolean).join(' ')]
    .filter((part) => part && part.trim())
    .join(', ');
  return {
    name: client.name,
    address,
    region: client.region,
    contactName: client.mainContact?.name,
    contactRole: client.mainContact?.role,
    contactPhone: client.mainContact?.phone,
    contactEmail: client.mainContact?.email,
  };
}
