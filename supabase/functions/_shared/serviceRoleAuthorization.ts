type JwtClaims = { role?: unknown };

const decodeJwtClaims = (token: string): JwtClaims | null => {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as JwtClaims;
  } catch {
    return null;
  }
};

// Call only behind Supabase Edge Function JWT verification. The claim fallback
// handles a gateway-validated service-role JWT whose forwarded representation
// differs from the legacy environment key.
export const isServiceRoleAuthorization = (
  authorization: string | null,
  serviceRoleKey: string | null,
) => {
  if (!authorization?.startsWith('Bearer ') || !serviceRoleKey) return false;
  const token = authorization.slice('Bearer '.length);
  if (token === serviceRoleKey) return true;
  return decodeJwtClaims(token)?.role === 'service_role';
};
