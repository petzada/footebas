import {
  FakeBearerAuth,
  type FootebasApplication,
  type JobQueuePort,
} from '@footebas/application';
import { coachAvatarSchema } from '@footebas/contracts';
import { describe, expect, it } from 'vitest';
import type { AvatarStore } from './avatar-routes.js';
import { createFetchHandler } from './fetch-router.js';
import { buildApi } from './index.js';
import type { ApiDependencies } from './routes.js';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

function setup() {
  const auth = new FakeBearerAuth();
  const token = auth.issue({
    userId: 'user_ana',
    email: 'ana@example.com',
    displayName: 'Ana',
  });
  const saved: { key: string; type: string; size: number }[] = [];
  const store: AvatarStore = {
    put(key, bytes, type) {
      saved.push({ key, type, size: bytes.byteLength });
      return Promise.resolve();
    },
  };
  const deps: ApiDependencies = {
    application: {} as FootebasApplication,
    jobs: {} as JobQueuePort,
    nextRequestId: () => 'request_test',
    documentation: false,
    avatars: {
      auth,
      store,
      publicBaseUrl: 'https://cdn.footebas.com.br',
      newId: () => 'abc123',
    },
  };
  return { deps, token, saved };
}

const upload = (body: Uint8Array, type: string, token?: string) =>
  new Request('https://api.footebas.com.br/v1/me/avatar', {
    method: 'POST',
    headers: {
      'content-type': type,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body,
  });

describe('POST /v1/me/avatar', () => {
  it('grava a imagem no bucket e devolve a URL pública aceita pelo contrato', async () => {
    const { deps, token, saved } = setup();
    const response = await createFetchHandler(deps)(
      upload(PNG, 'image/png', token),
    );
    expect(response.status).toBe(201);
    const { url } = (await response.json()) as { url: string };
    expect(url).toBe('https://cdn.footebas.com.br/avatars/user_ana/abc123.png');
    expect(saved).toEqual([
      {
        key: 'avatars/user_ana/abc123.png',
        type: 'image/png',
        size: PNG.length,
      },
    ]);
    expect(coachAvatarSchema.safeParse(url).success).toBe(true);
  });

  it('exige login, tipo de imagem válido e conteúdo que bate com o tipo', async () => {
    const { deps, token } = setup();
    const handler = createFetchHandler(deps);
    expect((await handler(upload(PNG, 'image/png'))).status).toBe(401);
    expect((await handler(upload(PNG, 'image/gif', token))).status).toBe(400);
    expect(
      (await handler(upload(new Uint8Array([1, 2, 3, 4]), 'image/jpeg', token)))
        .status,
    ).toBe(400);
  });

  it('recusa arquivos acima de 2 MB', async () => {
    const { deps, token } = setup();
    const big = new Uint8Array(2 * 1024 * 1024 + 4096);
    big.set(PNG);
    const response = await createFetchHandler(deps)(
      upload(big, 'image/png', token),
    );
    expect([400, 413]).toContain(response.status);
  });

  it('funciona também no servidor local (Fastify)', async () => {
    const { deps, token, saved } = setup();
    const api = await buildApi(deps);
    const response = await api.inject({
      method: 'POST',
      url: '/v1/me/avatar',
      headers: {
        'content-type': 'image/png',
        authorization: `Bearer ${token}`,
      },
      payload: Buffer.from(PNG),
    });
    expect(response.statusCode).toBe(201);
    expect(saved).toHaveLength(1);
    await api.close();
  });
});
