export const PRNG_VERSION = 'mulberry32-v1' as const;

export type PrngVersion = typeof PRNG_VERSION;

export interface Prng {
  readonly version: PrngVersion;
  next(): number;
  nextInt(minInclusive: number, maxInclusive: number): number;
  snapshot(): number;
}

export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createPrng(seed: string | number): Prng {
  let state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return {
    version: PRNG_VERSION,
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
    nextInt(minInclusive: number, maxInclusive: number): number {
      if (
        !Number.isSafeInteger(minInclusive) ||
        !Number.isSafeInteger(maxInclusive)
      ) {
        throw new RangeError('PRNG integer bounds must be safe integers');
      }
      if (maxInclusive < minInclusive)
        throw new RangeError('PRNG max must be >= min');
      return (
        minInclusive +
        Math.floor(this.next() * (maxInclusive - minInclusive + 1))
      );
    },
    snapshot(): number {
      return state;
    },
  };
}
