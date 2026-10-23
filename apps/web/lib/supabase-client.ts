import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Raised when the public Supabase settings are missing from the build. */
export class AuthConfigurationError extends Error {
  public constructor() {
    super(
      'O login não está configurado neste ambiente. Avise o suporte do Footebas.',
    );
    this.name = 'AuthConfigurationError';
  }
}

let client: SupabaseClient | undefined;

/**
 * Browser singleton. Created lazily so server rendering never touches
 * storage or starts refresh timers. Next.js only inlines NEXT_PUBLIC_*
 * values read with literal property access, so keep them spelled out.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new AuthConfigurationError();
  client = createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
