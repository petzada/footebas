/* eslint-disable @typescript-eslint/no-non-null-assertion -- indices come from the same arrays */
// Lean career save (`game-save-v3`, ADR 0014): the static catalog of the
// content version (clubs, athletes and their initial contracts) is rebuilt
// from the embedded content instead of being stored; the save keeps only what
// changed in the career. The encoding is exact: `hydrate(dehydrate(state))`
// has the same canonical JSON (and checksum) as `state`.
import {
  verifyChecksum,
  type CommandRepository,
  type GameSave,
  type GameSaveRepository,
  type NewGameSave,
  type SaveUpdate,
  type TransactionContext,
  type UnitOfWork,
} from '@footebas/database';
import { canonicalJson, type CanonicalValue } from '@footebas/domain';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import {
  catalogCareerContent,
  type CareerContent,
  type CareerContentPort,
} from './career-content.js';
import { createCareerWorld } from './career-world-rules.js';
import type { CareerSnapshot } from './service.js';

/** Current save schema: lean delta over the content catalog. */
export const CAREER_SAVE_SCHEMA = 'game-save-v3' as const;
/** Full snapshot saves (ADR 0006); migrated to v3 when loaded. */
export const LEGACY_CAREER_SAVE_SCHEMA = 'game-save-v2' as const;
const LEAN_FORMAT = 'lean-1';

/** The lean save cannot be rebuilt with the loaded content (needs migration). */
export class SaveCodecError extends Error {}

type Json = CanonicalValue;
type Obj = Record<string, Json>;
const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Structural equality with canonical semantics (undefined keys are absent). */
function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null
  )
    return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((item, index) => same(item, right[index]));
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (!same(a[key], b[key])) return false;
  return true;
}

const definedKeys = (value: Obj): string[] =>
  Object.keys(value).filter((key) => value[key] !== undefined);
const safeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

function gaps(positions: readonly number[]): number[] {
  let previous = -1;
  return positions.map((position) => {
    const gap = position - previous;
    previous = position;
    return gap;
  });
}
function ungaps(encoded: readonly number[]): number[] {
  let previous = -1;
  return encoded.map((gap) => (previous += gap));
}

// --- entity deltas -----------------------------------------------------------

const ABSENT = Symbol('absent');
interface Change {
  position: number;
  value: unknown;
  base: unknown;
}

/**
 * Columns of one changed field over the surviving baseline entities:
 * `i`/`v` sparse positions and values, `d` dense values (numeric deltas,
 * 0 = unchanged), `x` positions where the field is absent, `n` numeric delta.
 */
interface Column {
  i?: number[];
  v?: Json[];
  d?: number[];
  x?: number[];
  n?: 1;
}
interface EntityDelta {
  /** Removed baseline indices (gap encoded). */
  r?: number[];
  /** Entities absent from the baseline, in order. */
  a?: Json[];
  /** Explicit order when it is not baseline order followed by additions. */
  o?: number[];
  /** Changed fields by path (`field` or `field.subfield`). */
  c?: Record<string, Column>;
  /** Stored verbatim (duplicate ids): no delta possible. */
  raw?: Json[];
}

function uniqueIds(items: readonly Obj[]): boolean {
  const ids = new Set(items.map((item) => item.id));
  return (
    ids.size === items.length &&
    items.every((item) => typeof item.id === 'string')
  );
}

function encodeEntities(
  base: readonly Obj[],
  current: readonly Obj[],
): EntityDelta {
  if (!uniqueIds(base) || !uniqueIds(current)) return { raw: [...current] };
  const baseIndex = new Map(base.map((item, index) => [item.id, index]));
  const currentById = new Map(current.map((item) => [item.id, item]));
  const removed: number[] = [];
  const survivors: number[] = [];
  base.forEach((item, index) =>
    (currentById.has(item.id) ? survivors : removed).push(index),
  );
  const added = current.filter((item) => !baseIndex.has(item.id));
  const addedIndex = new Map(added.map((item, index) => [item.id, index]));
  const natural = [
    ...survivors.map((index) => base[index]?.id),
    ...added.map((item) => item.id),
  ];
  const ordered = current.every((item, index) => item.id === natural[index]);
  const changes = new Map<string, Change[]>();
  const record = (
    path: string,
    position: number,
    value: unknown,
    baseValue: unknown,
  ) => {
    let list = changes.get(path);
    if (list === undefined) changes.set(path, (list = []));
    list.push({ position, value, base: baseValue });
  };
  survivors.forEach((index, position) => {
    const before = base[index]!;
    const after = currentById.get(before.id)!;
    for (const key of new Set([
      ...definedKeys(before),
      ...definedKeys(after),
    ])) {
      const left = before[key];
      const right = after[key];
      if (isObj(left) && isObj(right)) {
        for (const sub of new Set([
          ...definedKeys(left),
          ...definedKeys(right),
        ]))
          if (!same(left[sub], right[sub]))
            record(
              `${key}.${sub}`,
              position,
              right[sub] === undefined ? ABSENT : right[sub],
              left[sub],
            );
      } else if (!same(left, right))
        record(key, position, right === undefined ? ABSENT : right, left);
    }
  });
  const columns: Record<string, Column> = {};
  for (const path of [...changes.keys()].sort()) {
    const list = changes.get(path) ?? [];
    const present = list.filter(({ value }) => value !== ABSENT);
    const absent = list.filter(({ value }) => value === ABSENT);
    const numeric = present.every(
      ({ value, base: before }) => safeInteger(value) && safeInteger(before),
    );
    const column: Column = {};
    if (numeric && absent.length === 0 && list.length * 2 > survivors.length) {
      const dense = new Array<number>(survivors.length).fill(0);
      for (const { position, value, base: before } of present)
        dense[position] = (value as number) - (before as number);
      column.d = dense;
      column.n = 1;
    } else if (present.length > 0) {
      column.i = gaps(present.map(({ position }) => position));
      column.v = present.map(({ value, base: before }) =>
        numeric ? (value as number) - (before as number) : (value as Json),
      );
      if (numeric) column.n = 1;
    }
    if (absent.length > 0)
      column.x = gaps(absent.map(({ position }) => position));
    columns[path] = column;
  }
  return {
    ...(removed.length > 0 ? { r: gaps(removed) } : {}),
    ...(added.length > 0 ? { a: added } : {}),
    ...(ordered
      ? {}
      : {
          o: current.map((item) => {
            const index = baseIndex.get(item.id);
            return index ?? -1 - (addedIndex.get(item.id) ?? 0);
          }),
        }),
    ...(Object.keys(columns).length > 0 ? { c: columns } : {}),
  };
}

function decodeEntities(base: readonly Obj[], delta: EntityDelta): Obj[] {
  if (delta.raw !== undefined) return delta.raw as Obj[];
  const removed = new Set(ungaps(delta.r ?? []));
  const survivorIndices = base
    .map((_, index) => index)
    .filter((index) => !removed.has(index));
  const survivors = survivorIndices.map((index) =>
    structuredClone(base[index])!,
  );
  const baseAt = (position: number) => base[survivorIndices[position] ?? -1];
  // Whole fields first, then subfields of objects present on both sides.
  const paths = Object.keys(delta.c ?? {}).sort(
    (left, right) =>
      Number(left.includes('.')) - Number(right.includes('.')) ||
      left.localeCompare(right),
  );
  for (const path of paths) {
    const column = delta.c![path]!;
    const dot = path.indexOf('.');
    const key = dot < 0 ? path : path.slice(0, dot);
    const sub = dot < 0 ? undefined : path.slice(dot + 1);
    const holder = (position: number): Obj | undefined => {
      const entity = survivors[position];
      if (entity === undefined) return undefined;
      if (sub === undefined) return entity;
      const nested = entity[key];
      return isObj(nested) ? nested : undefined;
    };
    const field = sub ?? key;
    const baseValue = (position: number): number => {
      const original = baseAt(position);
      const value =
        sub === undefined
          ? original?.[key]
          : isObj(original?.[key])
            ? original[key][sub]
            : undefined;
      if (!safeInteger(value))
        throw new SaveCodecError(`numeric delta without base at ${path}`);
      return value;
    };
    const assign = (position: number, encoded: Json) => {
      const target = holder(position);
      if (target === undefined)
        throw new SaveCodecError(
          `no entity for ${path} at ${String(position)}`,
        );
      target[field] =
        column.n === 1 ? baseValue(position) + (encoded as number) : encoded;
    };
    if (column.d !== undefined)
      column.d.forEach((encoded, position) => {
        if (encoded !== 0) assign(position, encoded);
      });
    if (column.i !== undefined) {
      const values = column.v ?? [];
      ungaps(column.i).forEach((position, index) =>
        assign(position, values[index] as Json),
      );
    }
    for (const position of ungaps(column.x ?? [])) {
      const target = holder(position);
      if (target !== undefined) Reflect.deleteProperty(target, field);
    }
  }
  const added = (delta.a ?? []) as Obj[];
  if (delta.o === undefined) return [...survivors, ...added];
  const bySurvivor = new Map(
    survivorIndices.map((index, position) => [index, survivors[position]]),
  );
  return delta.o.map((entry) => {
    const entity = entry >= 0 ? bySurvivor.get(entry) : added[-1 - entry];
    if (entity === undefined)
      throw new SaveCodecError(`entity order references ${String(entry)}`);
    return entity;
  });
}

// --- packing: arrays of objects become key tables ----------------------------

function pack(value: Json): Json {
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      // Canonical JSON rejects undefined array items; so does the save.
      if ((item as Json | undefined) === undefined)
        throw new SaveCodecError('undefined array item in save');
      return pack(item);
    });
    if (items.length < 2 || !items.every(isObj)) return items;
    const keysets: string[][] = [];
    const indexOf = new Map<string, number>();
    const rows = items.map((item) => {
      const keys = Object.keys(item);
      const signature = keys.join('\u0000');
      let index = indexOf.get(signature);
      if (index === undefined) {
        index = keysets.length;
        indexOf.set(signature, index);
        keysets.push(keys);
      }
      return { index, values: keys.map((key) => item[key] as Json) };
    });
    return keysets.length === 1
      ? { $k: keysets[0] ?? [], r: rows.map(({ values }) => values) }
      : {
          $t: keysets,
          r: rows.map(({ index, values }) => [index, ...values]),
        };
  }
  if (isObj(value)) {
    const keys = definedKeys(value).sort();
    for (const key of keys)
      if (key.startsWith('$'))
        throw new SaveCodecError(`reserved key ${key} in save`);
    // Records of objects (by id) become a key list plus a table.
    if (keys.length >= 4 && keys.every((key) => isObj(value[key])))
      return { $o: keys, v: pack(keys.map((key) => value[key] as Json)) };
    const result: Obj = {};
    for (const key of keys) result[key] = pack(value[key] as Json);
    return result;
  }
  return value;
}

function unpack(value: Json): Json {
  if (Array.isArray(value)) return value.map(unpack);
  if (!isObj(value)) return value;
  const rows = value.r;
  if (Array.isArray(value.$k) && Array.isArray(rows)) {
    const keys = value.$k as string[];
    return rows.map((row) => {
      const item: Obj = {};
      keys.forEach((key, index) => {
        item[key] = unpack((row as Json[])[index] as Json);
      });
      return item;
    });
  }
  if (Array.isArray(value.$t) && Array.isArray(rows)) {
    const keysets = value.$t as string[][];
    return rows.map((row) => {
      const [index, ...values] = row as Json[];
      const item: Obj = {};
      (keysets[index as number] ?? []).forEach((key, position) => {
        item[key] = unpack(values[position] as Json);
      });
      return item;
    });
  }
  if (Array.isArray(value.$o)) {
    const keys = value.$o as string[];
    const values = unpack(value.v as Json) as Json[];
    const record: Obj = {};
    keys.forEach((key, index) => {
      record[key] = values[index] as Json;
    });
    return record;
  }
  const result: Obj = {};
  for (const key of Object.keys(value))
    result[key] = unpack(value[key] as Json);
  return result;
}

// --- string interning: repeated strings become `~<base36>` references ---------

const ref = (index: number) => `~${index.toString(36)}`;

function intern(
  value: Json,
  seeds: ReadonlyMap<string, number>,
  seedCount: number,
): { dict: string[]; body: Json } {
  const counts = new Map<string, number>();
  const order: string[] = [];
  const count = (text: string) => {
    const seen = counts.get(text);
    if (seen === undefined) order.push(text);
    counts.set(text, (seen ?? 0) + 1);
  };
  const visit = (node: Json) => {
    if (typeof node === 'string') count(node);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (isObj(node))
      for (const key of Object.keys(node).sort()) {
        count(key);
        visit(node[key] as Json);
      }
  };
  visit(value);
  const dict: string[] = [];
  const local = new Map<string, number>();
  for (const text of order) {
    if (seeds.has(text) || (counts.get(text) ?? 0) < 2) continue;
    if (text.length <= ref(seedCount + dict.length).length) continue;
    local.set(text, seedCount + dict.length);
    dict.push(text);
  }
  const encode = (text: string): string => {
    const index = seeds.get(text) ?? local.get(text);
    if (index !== undefined && ref(index).length < text.length)
      return ref(index);
    return text.startsWith('~') ? `~${text}` : text;
  };
  const rewrite = (node: Json): Json => {
    if (typeof node === 'string') return encode(node);
    if (Array.isArray(node)) return node.map(rewrite);
    if (!isObj(node)) return node;
    const result: Obj = {};
    for (const key of Object.keys(node).sort())
      result[encode(key)] = rewrite(node[key] as Json);
    return result;
  };
  return { dict, body: rewrite(value) };
}

function unintern(value: Json, table: readonly string[]): Json {
  const decode = (text: string): string => {
    if (!text.startsWith('~')) return text;
    if (text.startsWith('~~')) return text.slice(1);
    const resolved = table[parseInt(text.slice(1), 36)];
    if (resolved === undefined)
      throw new SaveCodecError(`unknown string reference ${text}`);
    return resolved;
  };
  const rewrite = (node: Json): Json => {
    if (typeof node === 'string') return decode(node);
    if (Array.isArray(node)) return node.map(rewrite);
    if (!isObj(node)) return node;
    const result: Obj = {};
    for (const key of Object.keys(node))
      result[decode(key)] = rewrite(node[key] as Json);
    return result;
  };
  return rewrite(value);
}

// --- baseline built from the content catalog ---------------------------------

interface Baseline {
  readonly players: readonly Obj[];
  readonly clubs: readonly Obj[];
  readonly contracts: readonly Obj[];
  readonly seeds: readonly string[];
  readonly seedIndex: ReadonlyMap<string, number>;
  readonly digest: string;
}

/** FNV-1a (two 32-bit lanes): detects a drifted baseline, not tampering. */
function digestOf(text: string): string {
  let left = 0x811c9dc5;
  let right = 0x01000193 ^ text.length;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193) >>> 0;
    right = Math.imul(right ^ code, 0x5bd1e995) >>> 0;
  }
  return `${left.toString(16).padStart(8, '0')}${right.toString(16).padStart(8, '0')}`;
}

const baselines = new WeakMap<CareerContent, Map<number, Baseline>>();

function baselineFor(content: CareerContent, year: number): Baseline {
  let byYear = baselines.get(content);
  if (byYear === undefined)
    baselines.set(content, (byYear = new Map<number, Baseline>()));
  const cached = byYear.get(year);
  if (cached !== undefined) return cached;
  const players = content.players as unknown as readonly Obj[];
  const clubs = content.clubs as unknown as readonly Obj[];
  const contracts = createCareerWorld(
    content.clubs,
    content.players,
    `${String(year)}-01-01`,
    'manager_baseline',
  ).contracts as unknown as readonly Obj[];
  const seeds = [
    ...clubs.map(({ id }) => id as string),
    ...players.map(({ id }) => id as string),
  ];
  const baseline: Baseline = {
    players,
    clubs,
    contracts,
    seeds,
    seedIndex: new Map(seeds.map((id, index) => [id, index])),
    digest: digestOf(canonicalJson({ clubs, players, contracts })),
  };
  byYear.set(year, baseline);
  return baseline;
}

/** Lean career state before compression (what the logical checksum covers). */
interface LeanState {
  format: string;
  content: string;
  /** First season's year: initial contracts of the baseline. */
  year: number;
  digest: string;
  dict: string[];
  body: Json;
}
/** Stored form: the lean state with `dict` and `body` deflated (base64). */
interface StoredLean {
  format: string;
  content: string;
  year: number;
  digest: string;
  z: string;
}

/** Year of the career's first season (initial contracts start then). */
function startYear(snapshot: CareerSnapshot): number {
  return snapshot.history[0]?.year ?? snapshot.competition.year;
}

/** Full career state → lean state (only what differs from the catalog). */
function leanState(
  content: CareerContent,
  snapshot: CareerSnapshot,
): LeanState {
  if (snapshot.contentVersion !== content.version)
    throw new SaveCodecError(
      `save uses content ${snapshot.contentVersion}; ${content.version} requires migration`,
    );
  const year = startYear(snapshot);
  const baseline = baselineFor(content, year);
  const state = snapshot as unknown as Obj;
  const world = state.world as Obj;
  const body: Obj = {
    ...state,
    players: encodeEntities(
      baseline.players,
      state.players as Obj[],
    ) as unknown as Json,
    clubs: encodeEntities(
      baseline.clubs,
      state.clubs as Obj[],
    ) as unknown as Json,
    world: {
      ...world,
      contracts: encodeEntities(
        baseline.contracts,
        world.contracts as Obj[],
      ) as unknown as Json,
    },
  };
  const { dict, body: encoded } = intern(
    pack(body),
    baseline.seedIndex,
    baseline.seeds.length,
  );
  return {
    format: LEAN_FORMAT,
    content: content.version,
    year,
    digest: baseline.digest,
    dict,
    body: encoded,
  };
}

/**
 * Full career state → stored lean save: the delta over the catalog, packed,
 * interned and deflated. Deterministic for a given state.
 */
export function dehydrateCareer(
  content: CareerContent,
  snapshot: CareerSnapshot,
): CanonicalValue {
  const { dict, body, ...header } = leanState(content, snapshot);
  const stored: StoredLean = {
    ...header,
    z: deflateRawSync(
      Buffer.from(JSON.stringify({ dict, body }), 'utf8'),
    ).toString('base64'),
  };
  return stored as unknown as CanonicalValue;
}

/**
 * Logical checksum of a career state: SHA-256 of the canonical lean state
 * before compression. Equal states have equal checksums on any runtime.
 */
export function careerChecksum(
  content: CareerContent,
  snapshot: CareerSnapshot,
): string {
  return createHash('sha256')
    .update(canonicalJson(leanState(content, snapshot)), 'utf8')
    .digest('hex');
}

/** Lean save → full career state, rebuilt over the content catalog. */
export function hydrateCareer(
  content: CareerContent,
  stored: CanonicalValue,
): CareerSnapshot {
  if (!isObj(stored) || stored.format !== LEAN_FORMAT)
    throw new SaveCodecError('save is not a lean career save');
  const lean = stored as unknown as StoredLean;
  if (lean.content !== content.version)
    throw new SaveCodecError(
      `save uses content ${lean.content}; ${content.version} requires migration`,
    );
  const baseline = baselineFor(content, lean.year);
  if (baseline.digest !== lean.digest)
    throw new SaveCodecError(
      'catalog baseline changed since the save was written; migration required',
    );
  const packed = JSON.parse(
    inflateRawSync(Buffer.from(lean.z, 'base64')).toString('utf8'),
  ) as { dict: string[]; body: Json };
  const body = unpack(
    unintern(packed.body, [...baseline.seeds, ...packed.dict]),
  ) as Obj;
  const world = body.world as Obj;
  const snapshot: Obj = {
    ...body,
    players: decodeEntities(
      baseline.players,
      body.players as unknown as EntityDelta,
    ),
    clubs: decodeEntities(baseline.clubs, body.clubs as unknown as EntityDelta),
    world: {
      ...world,
      contracts: decodeEntities(
        baseline.contracts,
        world.contracts as unknown as EntityDelta,
      ),
    },
  };
  return snapshot as unknown as CareerSnapshot;
}

/**
 * Stored save → save with the full career state. Verifies the checksum of
 * what was stored, hydrates v3 and migrates v2 (already full) to v3; the
 * next write stores it lean. Other schemas pass through unchanged.
 */
export function hydrateStoredSave(
  save: GameSave,
  content: CareerContent,
): GameSave {
  if (!verifyChecksum(save)) throw new Error('save checksum mismatch');
  if (save.versions.schema === CAREER_SAVE_SCHEMA)
    return {
      ...save,
      snapshot: hydrateCareer(
        content,
        save.snapshot,
      ) as unknown as CanonicalValue,
    };
  if (save.versions.schema === LEGACY_CAREER_SAVE_SCHEMA)
    return {
      ...save,
      versions: { ...save.versions, schema: CAREER_SAVE_SCHEMA },
    };
  return save;
}

/** Snapshot to store for a write: lean for v3, verbatim otherwise. */
export function storedSnapshot(
  content: CareerContent,
  schema: string,
  snapshot: CanonicalValue,
): CanonicalValue {
  return schema === CAREER_SAVE_SCHEMA
    ? dehydrateCareer(content, snapshot as unknown as CareerSnapshot)
    : snapshot;
}

/** Marks a unit of work whose repositories already speak full snapshots. */
export const HYDRATED_SAVES: unique symbol = Symbol.for(
  'footebas.hydrated-career-saves',
);
export interface HydratedUnitOfWork extends UnitOfWork {
  readonly [HYDRATED_SAVES]: true;
}

class LeanSaveRepository implements GameSaveRepository {
  public constructor(
    private readonly inner: GameSaveRepository,
    private readonly content: CareerContentPort,
  ) {}
  private hydrate(save: GameSave): GameSave {
    return hydrateStoredSave(save, this.content.load());
  }
  public async create(input: NewGameSave): Promise<GameSave> {
    const stored = await this.inner.create({
      ...input,
      snapshot: storedSnapshot(
        this.content.load(),
        input.versions.schema,
        input.snapshot,
      ),
    });
    return { ...stored, snapshot: input.snapshot };
  }
  public async load(id: string, userId: string) {
    const save = await this.inner.load(id, userId);
    return save === undefined ? undefined : this.hydrate(save);
  }
  public async peek(id: string) {
    const save = await this.inner.peek(id);
    return save === undefined ? undefined : this.hydrate(save);
  }
  /** Saves that cannot be rebuilt (other content version) are left out. */
  public async listByUser(userId: string) {
    return (await this.inner.listByUser(userId)).flatMap((save) => {
      try {
        return [this.hydrate(save)];
      } catch (error) {
        if (error instanceof SaveCodecError) return [];
        throw error;
      }
    });
  }
  public countActiveByUser(userId: string) {
    return this.inner.countActiveByUser(userId);
  }
  public countActiveUsers() {
    return this.inner.countActiveUsers();
  }
  public async archive(id: string, userId: string, expectedVersion: number) {
    return this.hydrate(await this.inner.archive(id, userId, expectedVersion));
  }
  public delete(id: string, userId: string) {
    return this.inner.delete(id, userId);
  }
  public async update(
    id: string,
    userId: string,
    expectedVersion: number,
    update: SaveUpdate,
  ) {
    const stored = await this.inner.update(id, userId, expectedVersion, {
      ...update,
      snapshot: storedSnapshot(
        this.content.load(),
        update.versions.schema,
        update.snapshot,
      ),
    });
    return { ...stored, snapshot: update.snapshot };
  }
}

/** Full-state view over a storage save repository (tests, tools). */
export function careerSaveRepository(
  saves: GameSaveRepository,
  content: CareerContentPort = catalogCareerContent,
): GameSaveRepository {
  return new LeanSaveRepository(saves, content);
}

class LeanSaveUnitOfWork implements HydratedUnitOfWork {
  public readonly [HYDRATED_SAVES] = true as const;
  public constructor(
    private readonly inner: UnitOfWork,
    private readonly content: CareerContentPort,
  ) {}
  private wrap(tx: TransactionContext): TransactionContext {
    return {
      saves: new LeanSaveRepository(tx.saves, this.content),
      commands: tx.commands satisfies CommandRepository,
      achievements: tx.achievements,
    };
  }
  public withCareerLock<T>(
    careerId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.inner.withCareerLock(careerId, (tx) => work(this.wrap(tx)));
  }
  public executeIdempotent<T extends CanonicalValue>(
    careerId: string,
    commandId: string,
    work: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.inner.executeIdempotent(careerId, commandId, (tx) =>
      work(this.wrap(tx)),
    );
  }
}

/**
 * Unit of work whose saves carry the full career state: wraps a storage
 * unit of work (Postgres, memory) with the lean codec, unless it already
 * speaks full snapshots (the career Durable Object).
 */
export function careerUnitOfWork(
  unitOfWork: UnitOfWork,
  content: CareerContentPort,
): UnitOfWork {
  return HYDRATED_SAVES in unitOfWork
    ? unitOfWork
    : new LeanSaveUnitOfWork(unitOfWork, content);
}

/** Size helper for measurements and tests: JSON bytes of a stored save. */
export function storedSize(snapshot: CanonicalValue): number {
  return new TextEncoder().encode(JSON.stringify(snapshot)).length;
}
