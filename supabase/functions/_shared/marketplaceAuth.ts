import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function sanitizeSupabaseError(context: string) {
  console.error(`[marketplace-auth] ${context}`);
  return new Response('Request could not be completed', { status: 400 });
}

export async function requireAuthenticatedUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Response('Missing Authorization header', { status: 401 });

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) throw new Response('Unauthorized: invalid or expired token', { status: 401 });

  return user;
}

export async function requireStoreAdmin(serviceClient: any, userId: string, storeId: string) {
  const { data, error } = await serviceClient
    .from('store_administrators')
    .select('id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw sanitizeSupabaseError('store admin lookup failed');
  if (!data) throw new Response('Forbidden: store admin access required', { status: 403 });
}

export async function requirePlatformRole(serviceClient: any, userId: string, roles: string[]) {
  const { data, error } = await serviceClient
    .from('platform_user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', roles)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) throw sanitizeSupabaseError('platform role lookup failed');
  if (!data) throw new Response('Forbidden: platform role required', { status: 403 });
  return data.role as string;
}
