import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return json({ error: 'Google Maps is not configured' }, 500);
    }

    // Require a signed-in app user before any billable call
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'Invalid body' }, 400);

    const { action, input, placeId, sessionToken } = body as Record<string, unknown>;

    const gatewayHeaders = (fieldMask: string) => ({
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': fieldMask,
    });

    const relay = async (response: Response) => {
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Maps gateway failed [${response.status}]: ${errorBody}`);
        return json({ error: 'Google Maps request failed', status: response.status, details: errorBody }, response.status);
      }
      return json(await response.json());
    };

    if (action === 'autocomplete') {
      if (typeof input !== 'string' || input.trim().length < 3 || input.length > 200) {
        return json({ suggestions: [] });
      }
      const res = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
        method: 'POST',
        headers: gatewayHeaders('suggestions.placePrediction.placeId,suggestions.placePrediction.text.text'),
        body: JSON.stringify({
          input: input.trim(),
          ...(typeof sessionToken === 'string' ? { sessionToken } : {}),
          includedRegionCodes: ['se'],
        }),
      });
      return relay(res);
    }

    if (action === 'details') {
      if (typeof placeId !== 'string' || !/^[A-Za-z0-9_-]{5,200}$/.test(placeId)) {
        return json({ error: 'Invalid placeId' }, 400);
      }
      const qs = typeof sessionToken === 'string' ? `?sessionToken=${encodeURIComponent(sessionToken)}` : '';
      const res = await fetch(`${GATEWAY_URL}/places/v1/places/${placeId}${qs}`, {
        method: 'GET',
        headers: gatewayHeaders('id,formattedAddress,displayName,location'),
      });
      return relay(res);
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('maps-places error', e);
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});
