// Coach avatar upload: the image chosen in Nova Carreira goes to a public R2
// bucket (served at cdn.footebas.com.br) and its URL is what the career and
// the ranking show. Raw image bytes in the body, one image per request.
import {
  ApplicationError,
  AuthenticationError,
  type AuthPort,
} from '@footebas/application';
import type { ApiReply, ApiRequest, ApiRoute } from './routes.js';

/** Upper bound for an avatar upload (bytes). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** Where avatars are stored; the R2 bucket in production, a map in tests. */
export interface AvatarStore {
  put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
}

export interface AvatarRouteDependencies {
  readonly auth: AuthPort;
  readonly store: AvatarStore;
  /** Public base URL of the bucket, e.g. https://cdn.footebas.com.br */
  readonly publicBaseUrl: string;
  readonly newId?: () => string;
}

const FORMATS: Readonly<
  Record<string, { ext: string; magic: (bytes: Uint8Array) => boolean }>
> = {
  'image/png': {
    ext: 'png',
    magic: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  'image/jpeg': {
    ext: 'jpg',
    magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  'image/webp': {
    ext: 'webp',
    magic: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
};

/** R2 bucket binding shape (subset) as an avatar store. */
export function r2AvatarStore(bucket: {
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
    },
  ): Promise<unknown>;
}): AvatarStore {
  return {
    async put(key, bytes, contentType) {
      await bucket.put(key, bytes, {
        httpMetadata: {
          contentType,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
    },
  };
}

async function identity(auth: AuthPort, request: ApiRequest) {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ') || value.length === 7)
    throw new AuthenticationError('bearer token required');
  return auth.authenticate(value);
}

const json = (body: unknown, status = 200): ApiReply => ({ status, body });

export function avatarRoutes(deps: AvatarRouteDependencies): ApiRoute[] {
  const newId = deps.newId ?? (() => crypto.randomUUID().replaceAll('-', ''));
  const base = deps.publicBaseUrl.replace(/\/$/, '');
  return [
    {
      method: 'POST',
      path: '/v1/me/avatar',
      binary: true,
      schema: {
        security: [{ bearerAuth: [] }],
        summary: 'Upload a coach avatar (PNG, JPEG or WebP, up to 2 MB)',
      },
      async handler(request) {
        const { userId } = await identity(deps.auth, request);
        const [mime = ''] = (request.headers['content-type'] ?? '').split(';');
        const type = mime.trim().toLowerCase();
        const format = FORMATS[type];
        if (format === undefined)
          throw new ApplicationError(
            'VALIDATION_ERROR',
            'avatar must be a PNG, JPEG or WebP image',
          );
        const bytes = (await request.bytes?.()) ?? new ArrayBuffer(0);
        if (bytes.byteLength === 0 || bytes.byteLength > AVATAR_MAX_BYTES)
          throw new ApplicationError(
            'VALIDATION_ERROR',
            'avatar must have between 1 byte and 2 MB',
          );
        if (!format.magic(new Uint8Array(bytes.slice(0, 12))))
          throw new ApplicationError(
            'VALIDATION_ERROR',
            'file content does not match its image type',
          );
        const key = `avatars/${encodeURIComponent(userId)}/${newId()}.${format.ext}`;
        await deps.store.put(key, bytes, type);
        return json({ url: `${base}/${key}` }, 201);
      },
    },
  ];
}
