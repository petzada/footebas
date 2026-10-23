/**
 * Art direction for the Phaser match stage (retro 16-bit placeholder).
 *
 * Everything visual lives here and in `textures.ts`: palette, pixel maps,
 * board copy and fonts. The choreography and the scene logic never hard-code
 * colours or shapes, so an art pass can replace this file (and the texture
 * painters) without touching behaviour.
 */

export interface StageBoard {
  readonly text: string;
  readonly background: string;
  readonly ink: string;
}

export interface StageTheme {
  /** Art pixels per pitch unit (pitch is 100x64 units). */
  readonly artUnit: number;
  /** Canvas in pitch units: pitch plus touchline boards. */
  readonly canvas: Readonly<{ width: number; height: number }>;
  /** Where pitch unit (0, 0) sits inside the canvas, in units. */
  readonly pitchOffset: Readonly<{ x: number; y: number }>;
  readonly colors: Readonly<{
    stand: string;
    grassLight: string;
    grassDark: string;
    line: string;
    net: string;
    post: string;
    boardFrame: string;
    shadow: string;
    skin: string;
    hair: string;
    boots: string;
    ball: string;
    ballPatch: string;
    cardYellow: string;
    cardRed: string;
    cardOutline: string;
    plate: string;
    plateIn: string;
    plateOut: string;
    plateInk: string;
    injury: string;
    trail: string;
    bannerInk: string;
  }>;
  readonly shadowAlpha: number;
  /** Pixel map of a player, feet at the bottom row. See `textures.ts`. */
  readonly playerSprite: readonly string[];
  /** Top-left cell where shirt numbers are painted. */
  readonly numberOrigin: Readonly<{ row: number; column: number }>;
  readonly digits: Readonly<Record<string, readonly string[]>>;
  readonly ballSprite: readonly string[];
  readonly shadowSprite: readonly string[];
  readonly cardSprite: readonly string[];
  readonly injurySprite: readonly string[];
  readonly boards: readonly StageBoard[];
  readonly fonts: Readonly<{ board: string; plate: string; banner: string }>;
  /** Cheap pseudo-depth: sprites near the far touchline are drawn smaller. */
  readonly depthScale: Readonly<{ far: number; near: number }>;
}

export const stageTheme: StageTheme = {
  artUnit: 3,
  canvas: { width: 104, height: 76 },
  pitchOffset: { x: 2, y: 6 },
  colors: {
    stand: '#1b1f24',
    grassLight: '#3f9142',
    grassDark: '#357d38',
    line: '#f1f3e6',
    net: '#dfe3d6',
    post: '#ffffff',
    boardFrame: '#0d0f12',
    shadow: '#000000',
    skin: '#d9a273',
    hair: '#2a1b12',
    boots: '#111111',
    ball: '#f6f6f2',
    ballPatch: '#1d1d1d',
    cardYellow: '#f5cf17',
    cardRed: '#d7262b',
    cardOutline: '#1a1a1a',
    plate: '#101215',
    plateIn: '#39d36b',
    plateOut: '#ff5a4f',
    plateInk: '#f4f4f4',
    injury: '#e63b3b',
    trail: '#fff7b0',
    bannerInk: '#ffffff',
  },
  shadowAlpha: 0.3,
  // Legend: . empty, h hair, s skin, S shirt, D shirt shade, W shorts, k boots.
  playerSprite: [
    '....hhh....',
    '...hhhhh...',
    '...sssss...',
    '....sss....',
    '.SSSSSSSSD.',
    'SSSSSSSSSDD',
    'sSSSSSSSSDs',
    'sSSSSSSSSDs',
    '.SSSSSSSSD.',
    '.SSSSSSSSD.',
    '.SSSSSSSSD.',
    '..WWWWWWW..',
    '..WWW.WWW..',
    '..ss...ss..',
    '..kk...kk..',
  ],
  numberOrigin: { row: 5, column: 2 },
  digits: {
    '0': ['###', '#.#', '#.#', '#.#', '###'],
    '1': ['.#.', '##.', '.#.', '.#.', '###'],
    '2': ['###', '..#', '###', '#..', '###'],
    '3': ['###', '..#', '.##', '..#', '###'],
    '4': ['#.#', '#.#', '###', '..#', '..#'],
    '5': ['###', '#..', '###', '..#', '###'],
    '6': ['###', '#..', '###', '#.#', '###'],
    '7': ['###', '..#', '.#.', '.#.', '.#.'],
    '8': ['###', '#.#', '###', '#.#', '###'],
    '9': ['###', '#.#', '###', '..#', '###'],
  },
  // Legend: . empty, w ball, b patch.
  ballSprite: ['.ww.', 'wwbw', 'wbww', '.ww.'],
  shadowSprite: ['..#####..', '#########', '..#####..'],
  // Legend: . empty, o outline, c card colour.
  cardSprite: ['oooo', 'occo', 'occo', 'occo', 'occo', 'oooo'],
  // Legend: . empty, o outline, w white, r red cross.
  injurySprite: ['ooooooo', 'owwrwwo', 'owrrrwo', 'owwrwwo', 'ooooooo'],
  boards: [
    { text: 'FOOTEBAS', background: '#c62f2f', ink: '#ffffff' },
    { text: 'RODADA RÁPIDA', background: '#1f4f9a', ink: '#ffe14d' },
    { text: 'VÁRZEA FM', background: '#f2c230', ink: '#1b1f24' },
    { text: 'MERCADO DA BOLA', background: '#2b8a4b', ink: '#ffffff' },
  ],
  fonts: {
    board: '"Courier New", Courier, monospace',
    plate: '"Courier New", Courier, monospace',
    banner: '"Courier New", Courier, monospace',
  },
  depthScale: { far: 0.92, near: 1.08 },
};
