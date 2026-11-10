/**
 * Stable looks of an athlete, shared by the 3D match and the portraits: the
 * same id always gets the same skin, hair and boots, so the athlete on the
 * card is the athlete on the pitch. Presentation only.
 */

export const SKIN_TONES = [
  '#f1c9a5',
  '#e0ac7e',
  '#c68a5c',
  '#a56b43',
  '#7b4b2a',
  '#5a3620',
];
export const HAIR_TONES = [
  '#17120f',
  '#2a1b12',
  '#4a2f1b',
  '#8a5a2b',
  '#c9a15a',
  '#d8d2c8',
];
const BOOTS = [
  '#111316',
  '#f4f4f0',
  '#ff5a1f',
  '#18c2ff',
  '#e7ff54',
  '#111316',
];

export function physiqueHash(text: string): number {
  let value = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16_777_619);
  }
  return value >>> 0;
}

/** Stable skin, hair and boots for an athlete id. Pure. */
export function physiqueFor(id: string) {
  const value = physiqueHash(id);
  return {
    skin: SKIN_TONES[value % SKIN_TONES.length]!,
    hair: HAIR_TONES[(value >>> 5) % HAIR_TONES.length]!,
    boots: BOOTS[(value >>> 11) % BOOTS.length]!,
    /** Further bits for anything else that should vary per athlete. */
    variant: value >>> 14,
  };
}
