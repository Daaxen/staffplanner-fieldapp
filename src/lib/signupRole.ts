import type { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];

/**
 * Mirrors the database trigger `public.handle_new_user`.
 *
 * SECURITY: signup metadata is fully untrusted and must never influence the
 * assigned application role. New users always become `installer`; the only
 * exception is bootstrapping the very first account of an empty system.
 */
export const resolveSignupRole = (
  _signupMetadata: unknown,
  isFirstUser: boolean,
): AppRole => (isFirstUser ? 'admin' : 'installer');
