import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markScreen, resetRumForTests, startRum } from '@/lib/rum';

vi.mock('web-vitals/attribution', () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

const beacons: { url: string; body: Blob }[] = [];

// jsdom's Blob has no text(): read it the old way.
function read(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(blob);
  });
}

async function sent(): Promise<unknown[]> {
  return Promise.all(
    beacons.map(async ({ body }) => JSON.parse(await read(body)) as unknown),
  );
}

function hide() {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'hidden',
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Runs the rAF + timeout that markScreen waits for. */
async function painted() {
  await vi.advanceTimersByTimeAsync(50);
}

describe('RUM do web', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'requestAnimationFrame'] });
    beacons.length = 0;
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: (url: string, body: Blob) => {
        beacons.push({ url, body });
        return true;
      },
    });
    resetRumForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  it('sem API não coleta nem envia nada', async () => {
    startRum(undefined);
    markScreen('central');
    await painted();
    hide();
    expect(beacons).toEqual([]);
  });

  it('mede a troca de tela a partir do toque e envia ao esconder a página', async () => {
    startRum('https://api.footebas.com.br/');
    window.dispatchEvent(new Event('pointerdown'));
    markScreen('squad');
    await painted();
    hide();
    expect(beacons.map(({ url }) => url)).toEqual([
      'https://api.footebas.com.br/v1/telemetry/vitals',
    ]);
    expect(beacons[0]?.body.type).toBe('text/plain');
    expect(await sent()).toEqual([
      {
        page: 'game',
        metrics: [
          { name: 'screen-switch', value: expect.any(Number), label: 'squad' },
        ],
      },
    ]);
  });

  it('a primeira Central vira central-visible; sem toque, só ela', async () => {
    startRum('https://api.footebas.com.br');
    markScreen('central');
    await painted();
    markScreen('central');
    await painted();
    hide();
    expect(await sent()).toEqual([
      {
        page: 'game',
        metrics: [
          {
            name: 'central-visible',
            value: expect.any(Number),
            label: 'navigation',
          },
        ],
      },
    ]);
  });
});
