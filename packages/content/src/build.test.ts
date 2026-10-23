import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCatalog, type ExtraClubConfig } from './build.js';
import { parseCatalog } from './catalog.js';
import { loadCatalog } from './index.js';

const root = join(import.meta.dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const config = JSON.parse(
  read('packages/content/config/competitions-2026.json'),
) as { sources: Record<string, string> };
const extras = JSON.parse(read('packages/content/config/extra-clubs.json')) as {
  clubs: ExtraClubConfig[];
};
const glueFile = 'dados/elencos/forca-relativa-cola.md';
const highlightsFile = 'dados/elencos/destaques-2026.md';
const hasHighlights = existsSync(join(root, highlightsFile));
const input = {
  contentVersion: 'catalog-2026-07-v3',
  snapshotDate: '2026-07',
  files: Object.fromEntries(
    [
      ...Object.values(config.sources),
      glueFile,
      ...extras.clubs.map(({ source }) => source),
      ...(hasHighlights ? [highlightsFile] : []),
    ].map((path) => [path, read(path)]),
  ),
  competitionConfig: config,
  glueFile,
  extraClubs: extras.clubs,
  ...(hasHighlights ? { highlightsFile } : {}),
};

describe('catálogo canônico de conteúdo', () => {
  it('é determinístico e igual ao catálogo gerado versionado', () => {
    const first = buildCatalog(input);
    expect(buildCatalog(input)).toEqual(first);
    expect(loadCatalog()).toEqual(JSON.parse(JSON.stringify(first)));
  });

  it('cobre as três divisões com IDs independentes de divisão', () => {
    const catalog = loadCatalog();
    expect(
      catalog.clubs.filter(({ origin }) => origin === 'national'),
    ).toHaveLength(60);
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
      expect(player.derived.version).toBe('relative-strength-derived-v3');
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

  it('inclui estrangeiros da Libertadores e clubes estaduais com elenco jogável', () => {
    const catalog = loadCatalog();
    const foreign = catalog.clubs.filter(({ origin }) => origin === 'foreign');
    expect(foreign).toHaveLength(10);
    expect(foreign.every(({ division }) => division === undefined)).toBe(true);
    expect(catalog.competitions.continental.fixedClubIds).toEqual(
      foreign.map(({ id }) => id),
    );
    expect(catalog.clubs.find(({ name }) => name === 'Primavera')?.origin).toBe(
      'state',
    );
    expect(
      catalog.competitions.stateLeagues
        .find(({ id }) => id === 'paulistao')
        ?.participants.some(([id]) => id === 'club_primavera'),
    ).toBe(true);
    expect(
      catalog.notes.filter(
        ({ kind }) => kind === 'club-without-playable-squad',
      ),
    ).toHaveLength(0);
  });

  it('limita cada elenco a 35 atletas sem perder o piso por posição', () => {
    const catalog = loadCatalog();
    for (const club of catalog.clubs) {
      const roster = catalog.players.filter(({ clubId }) => clubId === club.id);
      expect(roster.length).toBeLessThanOrEqual(35);
      expect(
        roster.filter(({ position }) => position === 'GK').length,
      ).toBeGreaterThanOrEqual(2);
    }
    expect(
      catalog.notes.filter(({ kind }) => kind === 'excluded-over-cap').length,
    ).toBeGreaterThan(0);
  });

  it('marca os destaques da pesquisa com fonte e vantagem nos atributos', () => {
    const catalog = loadCatalog();
    const craques = catalog.players.filter(
      ({ highlight }) => highlight?.level === 'craque',
    );
    expect(craques.length).toBeGreaterThanOrEqual(10);
    for (const player of craques) {
      expect(player.highlight?.source).toMatch(
        /^(https?:\/\/|dados\/elencos\/)/,
      );
      expect(player.derived.bigGame).toBeGreaterThanOrEqual(85);
    }
    const flamengo = catalog.players.filter(
      ({ clubId }) => clubId === 'club_flamengo',
    );
    const best = [...flamengo].sort(
      (a, b) => b.derived.strength - a.derived.strength,
    )[0];
    expect(best?.highlight).toBeDefined();
  });
});
