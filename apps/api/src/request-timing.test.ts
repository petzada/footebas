import { describe, expect, it } from 'vitest';
import {
  coloOfRequest,
  coloOfTrace,
  isolateLocation,
  QueryCounter,
} from './request-timing.js';

describe('medição por requisição', () => {
  it('conta cada consulta enviada pelo cliente', () => {
    const counter = new QueryCounter();
    counter.hook();
    counter.hook();
    expect(counter.count).toBe(2);
  });

  it('lê o colo do trace e da requisição', () => {
    expect(coloOfTrace('fl=1\nh=x\ncolo=IAD\nhttp=http/2\n')).toBe('IAD');
    expect(coloOfTrace('sem colo')).toBeUndefined();
    const request = Object.assign(new Request('https://api.test/'), {
      cf: { colo: 'GRU' },
    });
    expect(coloOfRequest(request)).toBe('GRU');
    expect(coloOfRequest(new Request('https://api.test/'))).toBeUndefined();
  });

  it('sonda o local do isolate uma vez e responde depois', async () => {
    let probes = 0;
    const probe = () => {
      probes++;
      return Promise.resolve('colo=EWR\n');
    };
    expect(isolateLocation(probe)).toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();
    expect(isolateLocation(probe)).toBe('EWR');
    expect(probes).toBe(1);
  });
});
