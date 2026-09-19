import { supabase } from '@/integrations/supabase/client';

/**
 * Internal feedback module ("Feedback & Förbättringar").
 *
 * Every item stores the reporter's context automatically (user, role, time,
 * page, order/project number, device, browser) so improvements can be based on
 * actual usage. Attachments reuse the existing private `field-photos` bucket.
 */

export type FeedbackType = 'bug' | 'improvement' | 'feature' | 'mobile' | 'other';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'new' | 'investigating' | 'planned' | 'resolved' | 'rejected';

export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: 'Bugg' },
  { value: 'improvement', label: 'Förbättringsförslag' },
  { value: 'feature', label: 'Ny funktion' },
  { value: 'mobile', label: 'Mobilproblem' },
  { value: 'other', label: 'Övrigt' },
];

export const FEEDBACK_PRIORITIES: { value: FeedbackPriority; label: string }[] = [
  { value: 'low', label: 'Låg' },
  { value: 'medium', label: 'Normal' },
  { value: 'high', label: 'Hög' },
  { value: 'critical', label: 'Kritisk' },
];

export const FEEDBACK_STATUSES: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'Ny' },
  { value: 'investigating', label: 'Under utredning' },
  { value: 'planned', label: 'Planerad' },
  { value: 'resolved', label: 'Löst' },
  { value: 'rejected', label: 'Avvisad' },
];

export const typeLabel = (v: string) => FEEDBACK_TYPES.find(t => t.value === v)?.label ?? v;
export const priorityLabel = (v: string) => FEEDBACK_PRIORITIES.find(t => t.value === v)?.label ?? v;
export const statusLabel = (v: string) => FEEDBACK_STATUSES.find(t => t.value === v)?.label ?? v;

/** Votes only make sense on things we could build. */
export const VOTABLE_TYPES: FeedbackType[] = ['improvement', 'feature'];
export const OPEN_STATUSES: FeedbackStatus[] = ['new', 'investigating', 'planned'];

export interface FeedbackItem {
  id: string;
  title: string;
  type: FeedbackType;
  priority: FeedbackPriority;
  description: string;
  attachments: string[];
  status: FeedbackStatus;
  admin_note: string | null;
  resolved_at: string | null;
  created_by: string | null;
  reporter_name: string | null;
  reporter_role: string | null;
  page_path: string | null;
  order_number: string | null;
  project_number: string | null;
  device: string | null;
  browser: string | null;
  created_at: string;
  updated_at: string;
  votes: number;
  votedByMe: boolean;
}

export interface FeedbackContext {
  page_path: string;
  order_number: string | null;
  project_number: string | null;
  device: string;
  browser: string;
}

/** Best-effort browser name + version from the user agent. */
export function detectBrowser(ua = navigator.userAgent): string {
  const m =
    /(Edg|EdgiOS)\/([\d.]+)/.exec(ua) ??
    /(OPR|Opera)\/([\d.]+)/.exec(ua) ??
    /(Chrome|CriOS)\/([\d.]+)/.exec(ua) ??
    /(Firefox|FxiOS)\/([\d.]+)/.exec(ua) ??
    /(Version)\/([\d.]+).*Safari/.exec(ua);
  if (!m) return 'Okänd webbläsare';
  const name = { Edg: 'Edge', EdgiOS: 'Edge', OPR: 'Opera', CriOS: 'Chrome', FxiOS: 'Firefox', Version: 'Safari' }[m[1]] ?? m[1];
  return `${name} ${m[2].split('.')[0]}`;
}

/** Coarse device description: platform + screen size. */
export function detectDevice(ua = navigator.userAgent, width = window.innerWidth, height = window.innerHeight): string {
  const kind = /iPad|Tablet/i.test(ua) ? 'Surfplatta' : /Mobi|iPhone|Android/i.test(ua) ? 'Mobil' : 'Dator';
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? 'iOS'
    : /Android/i.test(ua)
      ? 'Android'
      : /Mac OS X/i.test(ua)
        ? 'macOS'
        : /Windows/i.test(ua)
          ? 'Windows'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Okänt OS';
  return `${kind} · ${os} · ${width}×${height}`;
}

/** Everything the system records on the user's behalf. */
export function captureContext(extra?: { orderNumber?: string | null; projectNumber?: string | null; view?: string | null }): FeedbackContext {
  const path = `${window.location.pathname}${window.location.hash || ''}`;
  return {
    page_path: extra?.view ? `${path} (${extra.view})` : path,
    order_number: extra?.orderNumber ?? null,
    project_number: extra?.projectNumber ?? null,
    device: detectDevice(),
    browser: detectBrowser(),
  };
}

export const FEEDBACK_MAX_BYTES = 10 * 1024 * 1024;
export const FEEDBACK_ACCEPT = 'image/*,application/pdf';
const ALLOWED = /^(image\/|application\/pdf$)/;

export type AttachmentUpload = { path: string } | { error: string };

/** Uploads one attachment and returns its storage path. */
export async function uploadAttachment(file: File): Promise<AttachmentUpload> {
  if (!ALLOWED.test(file.type)) return { error: 'Bilagan måste vara en bild eller en PDF-fil.' };
  if (file.size > FEEDBACK_MAX_BYTES) return { error: 'Bilagan är för stor. Max 10 MB.' };
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: 'Du måste vara inloggad för att bifoga filer.' };
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg';
  const path = `${userId}/feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('field-photos')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) return { error: `Bilagan kunde inte laddas upp: ${error.message}` };
  return { path };
}

/** Short-lived link to an attachment. */
export async function attachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('field-photos').createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}

export interface FeedbackStats {
  open: number;
  resolved: number;
  total: number;
  topBugs: FeedbackItem[];
  topRequests: FeedbackItem[];
  byStatus: Record<FeedbackStatus, number>;
  byType: Record<string, number>;
}

/** Dashboard aggregation: most reported bugs, most requested features, open vs resolved. */
export function feedbackStats(items: FeedbackItem[]): FeedbackStats {
  const byStatus = { new: 0, investigating: 0, planned: 0, resolved: 0, rejected: 0 } as Record<FeedbackStatus, number>;
  const byType: Record<string, number> = {};
  for (const i of items) {
    byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
    byType[i.type] = (byType[i.type] ?? 0) + 1;
  }
  const rank = (a: FeedbackItem, b: FeedbackItem) =>
    b.votes - a.votes || b.created_at.localeCompare(a.created_at);
  return {
    open: items.filter(i => OPEN_STATUSES.includes(i.status)).length,
    resolved: byStatus.resolved,
    total: items.length,
    byStatus,
    byType,
    topBugs: items
      .filter(i => (i.type === 'bug' || i.type === 'mobile') && i.status !== 'rejected')
      .sort(rank)
      .slice(0, 5),
    topRequests: items
      .filter(i => VOTABLE_TYPES.includes(i.type) && i.status !== 'rejected')
      .sort(rank)
      .slice(0, 5),
  };
}
