// Pseudonymous request identity for rate limiting and logs. Nothing here
// authenticates: the bearer is hashed as-is and the JWT `sub` is read without
// verifying the signature (the routes still validate the token). Raw tokens,
// e-mails and IPs never leave this module.

export interface RequestIdentity {
  /** SHA-256 of the bearer token (rate limit key for signed-in callers). */
  readonly bearerHash?: string;
  /** Short SHA-256 of the JWT `sub` (or of the bearer when it is not a JWT); for logs. */
  readonly userHash?: string;
  /** SHA-256 of `cf-connecting-ip` (rate limit key for anonymous callers). */
  readonly ipHash?: string;
}

const encoder = new TextEncoder();

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('authorization');
  if (header === null) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token === undefined || token === '' ? undefined : token;
}

/** `sub` claim of a JWT, read without verifying it; `undefined` otherwise. */
export function unverifiedSubject(token: string): string | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const base64 = (parts[1] ?? '').replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as unknown;
    if (typeof payload !== 'object' || payload === null) return undefined;
    const sub = (payload as { sub?: unknown }).sub;
    return typeof sub === 'string' && sub !== '' ? sub : undefined;
  } catch {
    return undefined;
  }
}

export async function identifyRequest(
  request: Request,
): Promise<RequestIdentity> {
  const token = bearerToken(request);
  const ip = request.headers.get('cf-connecting-ip')?.trim();
  const [bearerHash, ipHash] = await Promise.all([
    token === undefined ? undefined : sha256Hex(`bearer:${token}`),
    ip === undefined || ip === '' ? undefined : sha256Hex(`ip:${ip}`),
  ]);
  let userHash: string | undefined;
  if (token !== undefined) {
    const subject = unverifiedSubject(token);
    userHash =
      subject === undefined
        ? bearerHash?.slice(0, 16)
        : (await sha256Hex(`user:${subject}`)).slice(0, 16);
  }
  return {
    ...(bearerHash === undefined ? {} : { bearerHash }),
    ...(userHash === undefined ? {} : { userHash }),
    ...(ipHash === undefined ? {} : { ipHash }),
  };
}
