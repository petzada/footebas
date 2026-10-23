import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog } from './build.js';
import { parseCatalog } from './catalog.js';
import { loadCatalog } from './index.js';

const root = join(import.meta.dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const config = JSON.parse(
  read('tools/sim-lab/config/mvp-competitions.json'),
) as { sources: Record<string, string> };
const glueFile = 'dados/elencos/forca-relativa-cola.md';
const input = {
  contentVersion: 'catalog-2026-07-v1',
  snapshotDate: '2026-07',
  files: Object.fromEntries(
    [...Object.values(config.sources), glueFile].map((path) => [
      path,
      read(path),
    ]),
  ),
  competitionConfig: config,
  glueFile,
};

describe('catálogo canônico de conteúdo', () => {
  it('é determinístico e igual ao catálogo gerado versionado', () => {
    const first = buildCatalog(input);
    expect(buildCatalog(input)).toEqual(first);
    expect(loadCatalog()).toEqual(JSON.parse(JSON.stringify(first)));
  });

  it('cobre as três divisões com IDs independentes de divisão', () => {
    const catalog = loadCatalog();
    expect(catalog.clubs).toHaveLength(60);
    for (const division of ['serie-a', 'serie-b', 'serie-c'])
      expect(
        catalog.clubs.filter((club) => club.division === division),
      ).toHaveLength(20);
    expect(catalog.clubs.every(({ id }) => !id.includes('serie'))).toBe(true);
    const flamengo = catalog.clubs.find(({ name }) => name === 'Flamengo');
    expect(flamengo).toMatchObject({ id: 'club_flamengo', tier: 'S+' });
  });

  it('preserva lacunas da pesquisa em vez de inventar fatos', () => {
    const catalog = loadCatalog();
    const unknown = catalog.players.filter(
      ({ shirt }) => shirt.status === 'unknown',
    );
    expect(unknown.length).toBeGreaterThan(0);
    expect(
      catalog.notes.filter(({ kind }) => kind === 'unknown-shirt'),
    ).toHaveLength(unknown.length);
    expect(catalog.clubs.filter(({ partial }) => partial).length).toBe(
      catalog.notes.filter(({ kind }) => kind === 'partial-club').length,
    );
    for (const player of catalog.players) {
      expect(player.source.file).toMatch(/^dados\/elencos\//);
      expect(player.derived.version).toBe('relative-strength-derived-v2');
    }
  });

  it('rastreia cada jogador até a linha do arquivo de origem', () => {
    const catalog = loadCatalog();
    const player = catalog.players.find(
      ({ clubId }) => clubId === 'club_flamengo',
    );
    if (player === undefined) throw new Error('Flamengo has no players');
    const line = read(player.source.file).split('\n')[player.source.line - 1];
    expect(line).toContain(player.name);
  });

  it('mantém o favoritismo da cola sem tornar ninguém imbatível', () => {
    const catalog = loadCatalog();
    const mean = (clubId: string) => {
      const values = catalog.players
        .filter((player) => player.clubId === clubId)
        .map(({ derived }) => derived.strength);
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };
    expect(mean('club_flamengo')).toBeGreaterThan(mean('club_remo'));
    expect(mean('club_remo')).toBeGreaterThan(mean('club_maranhao'));
    expect(
      Math.max(...catalog.players.map(({ derived }) => derived.strength)),
    ).toBeLessThan(95);
  });

  it('recusa catálogo com referência órfã ou duplicata', () => {
    const catalog = loadCatalog();
    expect(() =>
      parseCatalog({
        ...catalog,
        players: [...catalog.players, catalog.players[0]],
      }),
    ).toThrow(/duplicate player/);
    expect(() =>
      parseCatalog({
        ...catalog,
        players: catalog.players.map((player, index) =>
          index === 0 ? { ...player, clubId: 'club_inexistente' } : player,
        ),
      }),
    ).toThrow(/unknown club/);
  });
});
