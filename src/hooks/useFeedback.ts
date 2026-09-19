import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { FeedbackContext, FeedbackItem, FeedbackPriority, FeedbackStatus, FeedbackType } from '@/lib/feedback';

export interface NewFeedback {
  title: string;
  type: FeedbackType;
  priority: FeedbackPriority;
  description: string;
  attachments: string[];
  context: FeedbackContext;
}

type Row = Omit<FeedbackItem, 'votes' | 'votedByMe' | 'attachments'> & { attachments: unknown };

/** Loads feedback items with vote counts and provides create/vote/status actions. */
export function useFeedback() {
  const { user, isAdmin, isInstaller } = useAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: rows, error: e1 }, { data: votes, error: e2 }] = await Promise.all([
      supabase.from('feedback_items').select('*').order('created_at', { ascending: false }),
      supabase.from('feedback_votes').select('feedback_id, user_id'),
    ]);
    if (e1 || e2) {
      setError((e1 ?? e2)!.message);
      setLoading(false);
      return;
    }
    const counts = new Map<string, number>();
    const mine = new Set<string>();
    for (const v of votes ?? []) {
      counts.set(v.feedback_id, (counts.get(v.feedback_id) ?? 0) + 1);
      if (user && v.user_id === user.id) mine.add(v.feedback_id);
    }
    setItems(((rows ?? []) as Row[]).map(r => ({
      ...r,
      attachments: Array.isArray(r.attachments) ? (r.attachments as string[]) : [],
      votes: counts.get(r.id) ?? 0,
      votedByMe: mine.has(r.id),
    })));
    setError(null);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const create = useCallback(async (input: NewFeedback): Promise<string | null> => {
    if (!user) return 'Du måste vara inloggad.';
    const { data: profile } = await supabase
      .from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
    const { error: err } = await supabase.from('feedback_items').insert({
      title: input.title.trim(),
      type: input.type,
      priority: input.priority,
      description: input.description.trim(),
      attachments: input.attachments,
      created_by: user.id,
      reporter_name: profile?.full_name || profile?.email || user.email || null,
      reporter_role: isAdmin ? 'admin' : isInstaller ? 'installer' : 'user',
      ...input.context,
    });
    if (err) return err.message;
    await load();
    return null;
  }, [user, isAdmin, isInstaller, load]);

  const toggleVote = useCallback(async (item: FeedbackItem) => {
    if (!user) return;
    // Optimistic: voting should feel instant.
    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, votedByMe: !i.votedByMe, votes: i.votes + (i.votedByMe ? -1 : 1) }
      : i));
    const { error: err } = item.votedByMe
      ? await supabase.from('feedback_votes').delete().eq('feedback_id', item.id).eq('user_id', user.id)
      : await supabase.from('feedback_votes').insert({ feedback_id: item.id, user_id: user.id });
    if (err) await load();
  }, [user, load]);

  const setStatus = useCallback(async (id: string, status: FeedbackStatus, adminNote?: string) => {
    const { error: err } = await supabase
      .from('feedback_items')
      .update({
        status,
        admin_note: adminNote ?? undefined,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', id);
    if (err) return err.message;
    await load();
    return null;
  }, [load]);

  return { items, loading, error, reload: load, create, toggleVote, setStatus, isAdmin };
}
