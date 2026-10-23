import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  AuthConfigurationError,
  getSupabaseClient,
} from '@/lib/supabase-client';

export interface AuthUser {
  readonly id: string;
  readonly email?: string;
  readonly name?: string;
}

/** Identity seam of the web app: Supabase in production, a fake in tests. */
export interface AuthPort {
  /** Current bearer for the API; `forceRefresh` renews it first. */
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string | null>;
  /** Leaves the page for the Google consent screen. */
  signInWithGoogle(): Promise<void>;
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  /** Notifies every session change (including the initial one). */
  onChange(callback: (user: AuthUser | null) => void): () => void;
  currentUser(): Promise<AuthUser | null>;
  /** Finishes an OAuth or magic-link redirect on /auth/callback. */
  completeRedirect(url: string): Promise<void>;
}

/** An auth failure whose message is ready to show to the player. */
export class AuthFailure extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AuthFailure';
  }
}

export const CALLBACK_PATH = '/auth/callback';

export function assertEmail(email: string): string {
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    throw new AuthFailure('Informe um e-mail válido, como voce@exemplo.com.');
  return trimmed;
}

const messages: Partial<Record<string, string>> & {
  over_request_rate_limit: string;
} = {
  over_email_send_rate_limit:
    'Muitos e-mails em pouco tempo. Espere um minuto e tente de novo.',
  over_request_rate_limit:
    'Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.',
  email_address_invalid:
    'Esse e-mail não parece válido. Confira e tente de novo.',
  validation_failed: 'Esse e-mail não parece válido. Confira e tente de novo.',
  otp_expired: 'O link expirou ou já foi usado. Peça um novo.',
  flow_state_not_found:
    'Abra o link no mesmo navegador em que você pediu o acesso, ou peça um novo.',
  flow_state_expired: 'O link expirou. Peça um novo para entrar.',
  bad_code_verifier:
    'Abra o link no mesmo navegador em que você pediu o acesso, ou peça um novo.',
  provider_disabled: 'Esse jeito de entrar está desativado no momento.',
  email_provider_disabled: 'O login por e-mail está desativado no momento.',
  signup_disabled: 'Novos cadastros estão fechados no momento.',
  access_denied: 'O acesso foi cancelado. Tente entrar de novo.',
};

/** Turns a Supabase/OAuth error into a sentence the player can act on. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof AuthFailure || error instanceof AuthConfigurationError)
    return error.message;
  const { code, status, name } = (error ?? {}) as {
    code?: string;
    status?: number;
    name?: string;
  };
  const known = code ? messages[code] : undefined;
  if (known) return known;
  if (status === 429) return messages.over_request_rate_limit;
  if (name === 'AuthRetryableFetchError' || error instanceof TypeError)
    return 'Não foi possível falar com o servidor de login. Confira sua conexão.';
  return 'Não foi possível entrar agora. Tente novamente.';
}

function toUser(user: User | undefined | null): AuthUser | null {
  if (!user) return null;
  const metadata = user.user_metadata as {
    full_name?: unknown;
    name?: unknown;
  };
  const name = metadata.full_name ?? metadata.name;
  return {
    id: user.id,
    ...(user.email ? { email: user.email } : {}),
    ...(typeof name === 'string' && name ? { name } : {}),
  };
}

export class SupabaseAuth implements AuthPort {
  readonly #client: () => SupabaseClient;
  readonly #origin: () => string;

  public constructor(
    options: {
      client?: () => SupabaseClient;
      origin?: () => string;
    } = {},
  ) {
    this.#client = options.client ?? getSupabaseClient;
    this.#origin = options.origin ?? (() => globalThis.location.origin);
  }

  #redirectTo(): string {
    return `${this.#origin()}${CALLBACK_PATH}`;
  }

  async getAccessToken({ forceRefresh = false } = {}) {
    const auth = this.#client().auth;
    if (forceRefresh) {
      const { data, error } = await auth.refreshSession();
      return error ? null : (data.session?.access_token ?? null);
    }
    const { data } = await auth.getSession();
    return data.session?.access_token ?? null;
  }

  async signInWithGoogle() {
    const { error } = await this.#client().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: this.#redirectTo() },
    });
    if (error) throw new AuthFailure(authErrorMessage(error));
  }

  async sendMagicLink(email: string) {
    const { error } = await this.#client().auth.signInWithOtp({
      email: assertEmail(email),
      options: { emailRedirectTo: this.#redirectTo(), shouldCreateUser: true },
    });
    if (error) throw new AuthFailure(authErrorMessage(error));
  }

  async signOut() {
    // Even if revoking on the server fails, the local session is dropped.
    await this.#client()
      .auth.signOut()
      .catch(() => undefined);
  }

  onChange(callback: (user: AuthUser | null) => void) {
    let client: SupabaseClient;
    try {
      client = this.#client();
    } catch {
      // Misconfigured build: show the entry screen; its buttons explain why.
      queueMicrotask(() => callback(null));
      return () => undefined;
    }
    const { data } = client.auth.onAuthStateChange((_event, session) =>
      callback(toUser(session?.user)),
    );
    return () => data.subscription.unsubscribe();
  }

  async currentUser() {
    const { data } = await this.#client().auth.getSession();
    return toUser(data.session?.user);
  }

  async completeRedirect(url: string) {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    parsed.searchParams.forEach((value, key) => params.set(key, value));
    const redirectError = params.get('error_code') ?? params.get('error');
    if (redirectError)
      throw new AuthFailure(authErrorMessage({ code: redirectError }));

    const auth = this.#client().auth;
    // detectSessionInUrl already exchanges ?code= during initialization.
    const { error } = await auth.initialize();
    if (error) throw new AuthFailure(authErrorMessage(error));
    const { data } = await auth.getSession();
    if (data.session) return;
    const code = params.get('code');
    if (!code)
      throw new AuthFailure(
        'Não encontramos um login em andamento. Entre de novo.',
      );
    const exchanged = await auth.exchangeCodeForSession(code);
    if (exchanged.error)
      throw new AuthFailure(authErrorMessage(exchanged.error));
  }
}
