/**
 * Pixel-art canvases for the 3D stage (players, ball, shadows, plates, net,
 * crowd and boards), all drawn by code from `theme.ts` maps (ADR 0012 §3).
 * Renderer-agnostic: returns plain canvases that Three wraps in textures.
 */
import { hashSeed, seededRandom } from './choreography';
import {
  contrastInk,
  luminance,
  mapSize,
  normalizeHex,
  paintMap,
  shade,
} from './textures';
import type { StageTheme } from './theme';

export const RUN_FRAMES = 3;

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function contextOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  context.imageSmoothingEnabled = false;
  return context;
}

/** Leg rows of the base sprite swapped per running frame. */
const LEG_FRAMES: readonly (readonly [string, string])[] = [
  ['..ss...ss..', '..kk...kk..'],
  ['...ss.ss...', '...kk.kk...'],
  ['.ss.....ss.', '.kk.....kk.'],
];

export function playerFrameMap(
  theme: StageTheme,
  frame: number,
): readonly string[] {
  const legs = LEG_FRAMES[frame % LEG_FRAMES.length]!;
  const rows = [...theme.playerSprite];
  rows.splice(rows.length - 2, 2, legs[0], legs[1]);
  return rows;
}

/** One player sprite frame: club colour, shirt number and running pose. */
export function paintPlayer(
  theme: StageTheme,
  shirtColor: string,
  shirtNumber: number,
  frame: number,
): HTMLCanvasElement {
  const shirt = normalizeHex(shirtColor, '#888888');
  const map = playerFrameMap(theme, frame);
  const [width, height] = mapSize(map);
  const canvas = canvasOf(width, height);
  const context = contextOf(canvas);
  paintMap(context, map, {
    h: theme.colors.hair,
    s: theme.colors.skin,
    S: shirt,
    D: shade(shirt, 0.72),
    W: luminance(shirt) > 0.35 ? '#1d2636' : '#f2f2f2',
    k: theme.colors.boots,
  });
  const glyphs = String(Math.max(0, shirtNumber))
    .slice(-2)
    .split('')
    .map((digit) => theme.digits[digit] ?? []);
  const ink = { '#': contrastInk(shirt) };
  const start =
    glyphs.length === 1
      ? theme.numberOrigin.column + 2
      : theme.numberOrigin.column;
  glyphs.forEach((glyph, index) =>
    paintMap(context, glyph, ink, start + index * 4, theme.numberOrigin.row),
  );
  return canvas;
}

export function paintBall(theme: StageTheme): HTMLCanvasElement {
  const [width, height] = mapSize(theme.ballSprite);
  const canvas = canvasOf(width, height);
  paintMap(contextOf(canvas), theme.ballSprite, {
    w: theme.colors.ball,
    b: theme.colors.ballPatch,
  });
  return canvas;
}

export function paintShadow(theme: StageTheme): HTMLCanvasElement {
  const [width, height] = mapSize(theme.shadowSprite);
  const canvas = canvasOf(width, height);
  paintMap(contextOf(canvas), theme.shadowSprite, {
    '#': theme.colors.shadow,
  });
  return canvas;
}

export function paintCard(
  theme: StageTheme,
  card: 'yellow' | 'red',
): HTMLCanvasElement {
  const [width, height] = mapSize(theme.cardSprite);
  const canvas = canvasOf(width, height);
  paintMap(contextOf(canvas), theme.cardSprite, {
    o: theme.colors.cardOutline,
    c: card === 'red' ? theme.colors.cardRed : theme.colors.cardYellow,
  });
  return canvas;
}

export function paintInjury(theme: StageTheme): HTMLCanvasElement {
  const [width, height] = mapSize(theme.injurySprite);
  const canvas = canvasOf(width, height);
  paintMap(contextOf(canvas), theme.injurySprite, {
    o: theme.colors.cardOutline,
    w: '#ffffff',
    r: theme.colors.injury,
  });
  return canvas;
}

/** Goal net: a transparent grid, tiled on the net planes. */
export function paintNet(theme: StageTheme, cell = 4): HTMLCanvasElement {
  const canvas = canvasOf(cell, cell);
  const context = contextOf(canvas);
  context.fillStyle = theme.colors.net;
  context.fillRect(0, 0, cell, 1);
  context.fillRect(0, 0, 1, cell);
  return canvas;
}

/** Crowd: seeded pixel noise of shirts and skin, tiled on the stands. */
export function paintCrowd(
  seed: string,
  width = 64,
  height = 16,
): HTMLCanvasElement {
  const random = seededRandom(hashSeed(`crowd:${seed}`));
  const palette = [
    '#f4efe2',
    '#c8322b',
    '#1f4f9a',
    '#ffd23f',
    '#15201a',
    '#d9a273',
    '#2b8a4b',
    '#e6dcc3',
  ];
  const canvas = canvasOf(width, height);
  const context = contextOf(canvas);
  context.fillStyle = '#3a3330';
  context.fillRect(0, 0, width, height);
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 1) {
      context.fillStyle = palette[Math.floor(random() * palette.length)]!;
      context.fillRect(x, y, 1, 1);
      context.fillStyle = random() < 0.5 ? '#d9a273' : '#8a5a3b';
      context.fillRect(x, y + 1, 1, 1);
    }
  }
  return canvas;
}

/** Fictional advertising board, pixel lettering via the canvas font. */
export function paintBoard(
  theme: StageTheme,
  index: number,
  width = 192,
  height = 24,
): HTMLCanvasElement {
  const board = theme.boards[index % theme.boards.length]!;
  const canvas = canvasOf(width, height);
  const context = contextOf(canvas);
  context.fillStyle = board.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = theme.colors.boardFrame;
  context.fillRect(0, 0, width, 2);
  context.fillRect(0, height - 2, width, 2);
  context.fillStyle = board.ink;
  context.font = `bold ${Math.round(height * 0.55)}px ${theme.fonts.board}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(board.text, width / 2, height / 2 + 1, width - 12);
  return canvas;
}

/** Confetti colours: club colour, its shade, chalk and bulb yellow. */
export function confettiPalette(clubColor: string): readonly string[] {
  const base = normalizeHex(clubColor, '#ffd23f');
  return [base, shade(base, 1.3), '#f4efe2', '#ffd23f', shade(base, 0.7)];
}
