import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlToString(s: string): string {
  return new TextDecoder().decode(b64urlToBytes(s));
}

async function verifyHS256(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [h, p, s] = parts;
  const header = JSON.parse(b64urlToString(h));
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('Unsupported alg');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const data = new TextEncoder().encode(`${h}.${p}`);
  const ok = await crypto.subtle.verify('HMAC', key, b64urlToBytes(s), data);
  if (!ok) throw new Error('Bad signature');
  return JSON.parse(b64urlToString(p));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const secret = Deno.env.get('GRADE_HARMONY_SSO_SECRET');
    if (!secret) throw new Error('SSO secret not configured');

    const claims = await verifyHS256(token, secret);
    const now = Math.floor(Date.now() / 1000);
    const skew = 60;

    if (claims.iss !== 'grade-harmony') throw new Error('Invalid issuer');
    if (claims.aud !== 'daruu-connect') throw new Error('Invalid audience');
    if (claims.role !== 'secretary') throw new Error('Role not allowed');
    if (typeof claims.exp !== 'number' || claims.exp + skew < now) throw new Error('Token expired');
    if (typeof claims.iat !== 'number' || claims.iat - skew > now) throw new Error('Token not yet valid');
    if (!claims.jti || typeof claims.jti !== 'string') throw new Error('Missing jti');
    if (!claims.sub || typeof claims.sub !== 'string') throw new Error('Missing sub');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: insErr } = await supabase
      .from('sso_used_jtis')
      .insert({ jti: claims.jti, expires_at: new Date(claims.exp * 1000).toISOString() });
    if (insErr) {
      // Unique violation → replay
      return new Response(JSON.stringify({ error: 'Token already used' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = {
      id: claims.sub,
      name: claims.name || 'Secretary',
      role: 'secretary',
      email: claims.email || null,
    };

    return new Response(JSON.stringify({ success: true, user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'SSO verification failed' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});