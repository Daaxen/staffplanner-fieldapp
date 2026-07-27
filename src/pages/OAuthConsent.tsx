import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

// Local typed wrapper for the beta auth.oauth namespace.
type OAuthAPI = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthAPI }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get('authorization_id') ?? '';
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError('Missing authorization_id');
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = '/auth?next=' + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message ?? String(error));
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message ?? String(error)); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError('No redirect returned by the authorization server.'); }
    window.location.href = target;
  };

  if (error) return <main className="min-h-screen flex items-center justify-center p-6 text-sm text-destructive">Could not load this authorization request: {error}</main>;
  if (!details) return <main className="min-h-screen flex items-center justify-center p-6 text-muted-foreground">Loading…</main>;

  const clientName = details.client?.name ?? details.client?.client_name ?? 'an app';
  const scopes: string[] = details.requested_scopes ?? details.scopes ?? [];

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-5 rounded-lg border p-6 bg-card">
        <div>
          <h1 className="text-lg font-semibold">Connect {clientName} to StaffPlanner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            This lets {clientName} call StaffPlanner's tools while you are signed in.
            It does not bypass your permissions — the tools see only what your account can see.
          </p>
        </div>
        {scopes.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Requested access:</div>
            <ul className="list-disc pl-5 space-y-0.5">{scopes.map(s => <li key={s}>{s}</li>)}</ul>
          </div>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>Approve</Button>
          <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>Cancel</Button>
        </div>
      </div>
    </main>
  );
}
