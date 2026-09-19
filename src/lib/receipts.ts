import { supabase } from '@/integrations/supabase/client';
import { EXPENSE_RULES } from '@/lib/validation/reporting';

/**
 * Receipt handling for expense entries. Receipts live in the existing
 * private `field-photos` bucket under the owner's auth folder, exactly like
 * field photos: the owner can read their own files, admins can read all.
 * The storage path is stored on expense_entries.receipt_path — no new table.
 */

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_ACCEPT = 'image/*,application/pdf';

const ALLOWED = /^(image\/|application\/pdf$)/;

/** True when the category requires a receipt at this amount. */
export function receiptRequired(category: string, amount: number): boolean {
  const rule = EXPENSE_RULES[category];
  if (!rule?.requiresReceipt) return false;
  return amount > rule.receiptThreshold;
}

/** Swedish message shown when a required receipt is missing. */
export function missingReceiptMessage(category: string): string {
  const rule = EXPENSE_RULES[category];
  return rule && rule.receiptThreshold > 0
    ? `Kvitto krävs för belopp över ${rule.receiptThreshold} kr. Fota eller bifoga kvittot innan du sparar.`
    : 'Kvitto krävs för den här kostnadstypen. Fota eller bifoga kvittot innan du sparar.';
}

export type ReceiptUpload = { path: string } | { error: string };

/** Uploads a receipt photo or PDF and returns its storage path. */
export async function uploadReceipt(file: File): Promise<ReceiptUpload> {
  if (!ALLOWED.test(file.type)) {
    return { error: 'Kvittot måste vara en bild eller en PDF-fil.' };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { error: 'Kvittot är för stort. Max 10 MB.' };
  }
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: 'Du måste vara inloggad för att ladda upp kvitto.' };

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'jpg';
  const path = `${userId}/receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('field-photos')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) return { error: `Kvittot kunde inte laddas upp: ${error.message}` };
  return { path };
}

/** Short-lived link to a stored receipt; null when the caller may not read it. */
export async function receiptUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('field-photos').createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}

/** Human-readable file name from a storage path. */
export function receiptFileName(path: string): string {
  return path.split('/').pop() ?? path;
}
