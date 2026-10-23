import {
  AuthFailure,
  assertEmail,
  type AuthPort,
  type AuthUser,
} from '@/lib/auth';

/** In-memory AuthPort for component and adapter tests. */
export class FakeAuth implements AuthPort {
  readonly calls = {
    google: 0,
    magicLinks: [] as string[],
    signOut: 0,
    refreshes: 0,
  };
  /** When set, the next sign-in attempt fails with this message. */
  failWith: string | undefined;
  #user: AuthUser | null;
  #token: string;
  readonly #listeners = new Set<(user: AuthUser | null) => void>();

  public constructor(options: { user?: AuthUser | null; token?: string } = {}) {
    this.#user = options.user ?? null;
    this.#token = options.token ?? 'fake-access-token';
  }

  /** Test helper: simulates a finished redirect for `user`. */
  signIn(user: AuthUser, token = this.#token) {
    this.#user = user;
    this.#token = token;
    this.#emit();
  }

  async getAccessToken({ forceRefresh = false } = {}) {
    if (!this.#user) return null;
    if (forceRefresh) this.calls.refreshes += 1;
    return this.#token;
  }

  async signInWithGoogle() {
    this.calls.google += 1;
    this.#failIfAsked();
  }

  async sendMagicLink(email: string) {
    const address = assertEmail(email);
    this.#failIfAsked();
    this.calls.magicLinks.push(address);
  }

  async signOut() {
    this.calls.signOut += 1;
    this.#user = null;
    this.#emit();
  }

  onChange(callback: (user: AuthUser | null) => void) {
    this.#listeners.add(callback);
    queueMicrotask(() => {
      if (this.#listeners.has(callback)) callback(this.#user);
    });
    return () => {
      this.#listeners.delete(callback);
    };
  }

  async currentUser() {
    return this.#user;
  }

  async completeRedirect() {
    this.#failIfAsked();
  }

  #failIfAsked() {
    const message = this.failWith;
    this.failWith = undefined;
    if (message) throw new AuthFailure(message);
  }

  #emit() {
    for (const listener of this.#listeners) listener(this.#user);
  }
}
