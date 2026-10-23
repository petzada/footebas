import type { FootebasApplication, JobQueuePort } from '@footebas/application';
import { describe, expect, it } from 'vitest';
import { createFetchHandler } from './fetch-router.js';
import { rumLogEntry } from './observability.js';
import { RUM_PATH, type RumReport } from './rum-route.js';

const report: RumReport = {
  page: 'game',
  connection: '4g',
  metrics: [
    { name: 'LCP', value: 2100, rating: 'good', label: 'main>h1' },
    { name: 'screen-switch', value: 85, label: 'squad' },
  ],
};

function handler(records: RumReport[]) {
  return createFetchHandler({
    application: {} as FootebasApplication,
    jobs: {} as JobQueuePort,
    rum: (entry) => records.push(entry),
  });
}

describe('POST /v1/telemetry/vitals', () => {
  it('aceita o beacon em text/plain e registra o relatório', async () => {
    const records: RumReport[] = [];
    const response = await handler(records)(
      new Request(`https://api.test${RUM_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(report),
      }),
    );
    expect(response.status).toBe(204);
    expect(records).toEqual([report]);
  });

  it('recusa métricas desconhecidas ou valores absurdos', async () => {
    const records: RumReport[] = [];
    for (const metrics of [
      [{ name: 'FID', value: 10 }],
      [{ name: 'LCP', value: -1 }],
      [],
    ]) {
      const response = await handler(records)(
        new Request(`https://api.test${RUM_PATH}`, {
          method: 'POST',
          body: JSON.stringify({ page: 'game', metrics }),
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(records).toEqual([]);
  });

  it('vira uma linha de log sem identidade do usuário', () => {
    expect(rumLogEntry(report, 'v1')).toEqual({
      type: 'rum',
      level: 'info',
      page: 'game',
      connection: '4g',
      metrics: report.metrics,
      version: 'v1',
    });
  });
});
