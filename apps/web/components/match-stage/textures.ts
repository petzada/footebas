/**
 * Code-drawn textures for the match stage. Only art lives here: swap the
 * painters (or `theme.ts`) for a new look without touching scene logic.
 */
import type * as PhaserType from 'phaser';
import { PITCH } from './choreography';
import type { StageTheme } from './theme';

type Scene = PhaserType.Scene;
type Palette = Readonly<Record<string, string | undefined>>;

export function normalizeHex(hex: string, fallback = '#888888'): string {
  const value = hex.trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(value))
    return `#${[...value].map((char) => char + char).join('')}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(value)) return `#${value}`.toLowerCase();
  return fallback;
}

export function colorNumber(hex: string): number {
  return Number.parseInt(normalizeHex(hex).slice(1), 16);
}

function channels(hex: string): readonly [number, number, number] {
  const value = colorNumber(hex);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function shade(hex: string, factor: number): string {
  const scaled = channels(hex).map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel * factor))),
  );
  return `#${scaled.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((channel) => {
    const unit = channel / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  }) as unknown as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastInk(hex: string): string {
  return luminance(hex) > 0.35 ? '#141414' : '#ffffff';
}

function paintMap(
  context: CanvasRenderingContext2D,
  map: readonly string[],
  palette: Palette,
  originX = 0,
  originY = 0,
) {
  map.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      const fill = palette[cell];
      if (!fill) return;
      context.fillStyle = fill;
      context.fillRect(originX + x, originY + y, 1, 1);
    });
  });
}

function ensureCanvasTexture(
  scene: Scene,
  key: string,
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return key;
  paint(texture.getContext());
  texture.refresh();
  return key;
}

function mapSize(map: readonly string[]): readonly [number, number] {
  return [Math.max(...map.map((row) => row.length)), map.length];
}

export function playerTexture(
  scene: Scene,
  theme: StageTheme,
  shirtHex: string,
  shirtNumber: number,
): string {
  const shirt = normalizeHex(shirtHex);
  const key = `stage-player-${shirt.slice(1)}-${shirtNumber}`;
  const [width, height] = mapSize(theme.playerSprite);
  return ensureCanvasTexture(scene, key, width, height, (context) => {
    paintMap(context, theme.playerSprite, {
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
  });
}

export function playerSpriteSize(theme: StageTheme): readonly [number, number] {
  return mapSize(theme.playerSprite);
}

export function ballTexture(scene: Scene, theme: StageTheme): string {
  const [width, height] = mapSize(theme.ballSprite);
  return ensureCanvasTexture(scene, 'stage-ball', width, height, (context) =>
    paintMap(context, theme.ballSprite, {
      w: theme.colors.ball,
      b: theme.colors.ballPatch,
    }),
  );
}

export function shadowTexture(scene: Scene, theme: StageTheme): string {
  const [width, height] = mapSize(theme.shadowSprite);
  return ensureCanvasTexture(scene, 'stage-shadow', width, height, (context) =>
    paintMap(context, theme.shadowSprite, { '#': theme.colors.shadow }),
  );
}

export function cardTexture(
  scene: Scene,
  theme: StageTheme,
  card: 'yellow' | 'red',
): string {
  const [width, height] = mapSize(theme.cardSprite);
  return ensureCanvasTexture(
    scene,
    `stage-card-${card}`,
    width,
    height,
    (context) =>
      paintMap(context, theme.cardSprite, {
        o: theme.colors.cardOutline,
        c: card === 'red' ? theme.colors.cardRed : theme.colors.cardYellow,
      }),
  );
}

export function injuryTexture(scene: Scene, theme: StageTheme): string {
  const [width, height] = mapSize(theme.injurySprite);
  return ensureCanvasTexture(scene, 'stage-injury', width, height, (context) =>
    paintMap(context, theme.injurySprite, {
      o: theme.colors.cardOutline,
      w: '#ffffff',
      r: theme.colors.injury,
    }),
  );
}

/**
 * Paints the static stadium (boards, striped grass, lines, goals) once.
 * `scale` is backing pixels per art pixel; `unit` is backing pixels per
 * pitch unit.
 */
export function paintStadium(
  scene: Scene,
  theme: StageTheme,
  scale: number,
): void {
  const unit = theme.artUnit * scale;
  const ox = theme.pitchOffset.x * unit;
  const oy = theme.pitchOffset.y * unit;
  const graphics = scene.add.graphics();
  graphics.setDepth(0);

  graphics.fillStyle(colorNumber(theme.colors.stand), 1);
  graphics.fillRect(
    0,
    0,
    theme.canvas.width * unit,
    theme.canvas.height * unit,
  );

  // Touchline boards above and below the pitch.
  const boardHeight = 4.4 * unit;
  const rows = [0.8 * unit, oy + PITCH.height * unit + 0.8 * unit];
  const boardWidth = (theme.canvas.width * unit) / theme.boards.length;
  rows.forEach((top, rowIndex) => {
    theme.boards.forEach((board, index) => {
      const shifted =
        theme.boards[(index + rowIndex * 2) % theme.boards.length] ?? board;
      const left = index * boardWidth;
      graphics.fillStyle(colorNumber(theme.colors.boardFrame), 1);
      graphics.fillRect(left, top, boardWidth, boardHeight);
      graphics.fillStyle(colorNumber(shifted.background), 1);
      graphics.fillRect(
        left + scale,
        top + scale,
        boardWidth - 2 * scale,
        boardHeight - 2 * scale,
      );
      scene.add
        .text(left + boardWidth / 2, top + boardHeight / 2, shifted.text, {
          fontFamily: theme.fonts.board,
          fontSize: `${Math.round(2.6 * unit)}px`,
          fontStyle: 'bold',
          color: shifted.ink,
        })
        .setOrigin(0.5)
        .setDepth(1);
    });
  });

  // Mown stripes.
  const stripes = 10;
  const stripeWidth = (PITCH.width * unit) / stripes;
  for (let index = 0; index < stripes; index += 1) {
    graphics.fillStyle(
      colorNumber(
        index % 2 === 0 ? theme.colors.grassLight : theme.colors.grassDark,
      ),
      1,
    );
    graphics.fillRect(
      ox + index * stripeWidth,
      oy,
      stripeWidth + 1,
      PITCH.height * unit,
    );
  }

  const at = (x: number, y: number) => [ox + x * unit, oy + y * unit] as const;
  graphics.lineStyle(scale, colorNumber(theme.colors.line), 0.9);
  const [left, top] = at(PITCH.left, PITCH.top);
  graphics.strokeRect(
    left,
    top,
    (PITCH.right - PITCH.left) * unit,
    (PITCH.bottom - PITCH.top) * unit,
  );
  const [midX] = at(50, 0);
  graphics.lineBetween(midX, top, midX, oy + PITCH.bottom * unit);
  const [centerX, centerY] = at(50, 32);
  graphics.strokeCircle(centerX, centerY, 9 * unit);
  graphics.fillStyle(colorNumber(theme.colors.line), 1);
  graphics.fillRect(centerX - scale, centerY - scale, 2 * scale, 2 * scale);
  for (const side of [0, 1] as const) {
    const lineX = side === 0 ? PITCH.left : PITCH.right;
    const inward = side === 0 ? 1 : -1;
    const box = (depth: number, half: number) => {
      const x = Math.min(lineX, lineX + inward * depth);
      const [bx, by] = at(x, 32 - half);
      graphics.strokeRect(bx, by, depth * unit, half * 2 * unit);
    };
    box(14, 17);
    box(6, 9);
    const [spotX, spotY] = at(lineX + inward * 10, 32);
    graphics.fillRect(spotX - scale, spotY - scale, 2 * scale, 2 * scale);
    // Goal and net behind the line.
    const netX = Math.min(lineX, lineX - inward * PITCH.netDepth);
    const [nx, ny] = at(netX, PITCH.goalTop);
    graphics.fillStyle(colorNumber(theme.colors.net), 0.35);
    graphics.fillRect(
      nx,
      ny,
      PITCH.netDepth * unit,
      (PITCH.goalBottom - PITCH.goalTop) * unit,
    );
    graphics.lineStyle(scale, colorNumber(theme.colors.post), 1);
    graphics.strokeRect(
      nx,
      ny,
      PITCH.netDepth * unit,
      (PITCH.goalBottom - PITCH.goalTop) * unit,
    );
    graphics.lineStyle(scale, colorNumber(theme.colors.line), 0.9);
    graphics.fillStyle(colorNumber(theme.colors.line), 1);
  }
}
