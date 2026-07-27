import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isPushConfigured, requestFcmToken, onForegroundPush } from '@/lib/firebase';
import { toast } from 'sonner';

export function usePushRegistration(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!isPushConfigured()) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await requestFcmToken();
        if (!token || cancelled) return;
        await supabase.functions.invoke('push-subscribe', {
          body: { fcm_token: token, platform: 'web', user_agent: navigator.userAgent },
        });
      } catch (e) {
        console.warn('[push] registration failed', e);
      }
    })();

    const unsub = onForegroundPush((payload) => {
      const p = payload as { notification?: { title?: string; body?: string } };
      toast.warning(p.notification?.title ?? 'Reminder', { description: p.notification?.body });
    });

    return () => { cancelled = true; unsub(); };
  }, [enabled]);
}
