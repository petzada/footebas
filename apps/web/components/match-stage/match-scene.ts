/**
 * Phaser scene that renders `sampleStage` frames. Render-only: it reads a
 * mutable controller written by React and never feeds anything back into
 * the score, the events or the statistics.
 */
import type * as PhaserType from 'phaser';
import type { ReplaySide } from '@/lib/match-replay-model';
import {
  PITCH,
  sampleStage,
  stepForMinute,
  type StageChoreography,
  type StageFrame,
} from './choreography';
import type { StageTheme } from './theme';
import {
  ballTexture,
  cardTexture,
  colorNumber,
  injuryTexture,
  paintStadium,
  playerSpriteSize,
  playerTexture,
  shadowTexture,
} from './textures';

export type PhaserModule = typeof PhaserType;

/** Real-time length of one segment at 1x; the viewer steps every 1100 ms. */
export const SEGMENT_MS = 1_000;

export interface StageController {
  readonly choreography: StageChoreography;
  readonly colors: Readonly<Record<ReplaySide, string>>;
  step: number;
  progress: number;
  paused: boolean;
  speed: number;
  onReady?: () => void;
  onSettled?: () => void;
}

/** Advances the segment clock; returns true while there is motion left. */
export function advanceController(
  controller: StageController,
  deltaMs: number,
): boolean {
  if (controller.paused || controller.progress >= 1) return false;
  const delta = Math.max(0, Math.min(deltaMs, 100));
  controller.progress = Math.min(
    1,
    controller.progress + (delta * controller.speed) / SEGMENT_MS,
  );
  return true;
}

/**
 * Writes the React replay state into the controller. Only the natural next
 * step animates; skips and rewinds snap to the rest pose, so "ver resultado"
 * is never held back by the animation.
 */
export function syncController(
  controller: StageController,
  state: Readonly<{ minute: number; playing: boolean; speed: number }>,
): void {
  const complete = state.minute >= controller.choreography.duration;
  controller.speed = state.speed;
  controller.paused = !state.playing && !complete;
  const target = stepForMinute(controller.choreography, state.minute);
  if (target === controller.step) return;
  const natural = target === controller.step + 1;
  controller.step = target;
  controller.progress = natural ? 0 : 1;
}

/** Backing pixels per art pixel: device pixel ratio capped at 2. */
export function pixelScaleFor(
  cssWidth: number,
  devicePixelRatio: number,
  theme: StageTheme,
): number {
  const ratio = Math.min(Math.max(devicePixelRatio || 1, 1), 2);
  const artWidth = theme.canvas.width * theme.artUnit;
  return Math.max(1, Math.min(4, Math.floor((cssWidth * ratio) / artWidth)));
}

export function createMatchScene(
  Phaser: PhaserModule,
  controller: StageController,
  theme: StageTheme,
  scale: number,
): PhaserModule['Scene'] {
  const unit = theme.artUnit * scale;
  const toX = (x: number) => (theme.pitchOffset.x + x) * unit;
  const toY = (y: number) => (theme.pitchOffset.y + y) * unit;
  const depthScale = (y: number) =>
    theme.depthScale.far +
    (theme.depthScale.near - theme.depthScale.far) * (y / PITCH.height);
  const [, spriteHeight] = playerSpriteSize(theme);

  return class MatchScene extends Phaser.Scene {
    private players: PhaserType.GameObjects.Image[] = [];
    private shadows: PhaserType.GameObjects.Image[] = [];
    private numbers: number[] = [];
    private ball!: PhaserType.GameObjects.Image;
    private ballShadow!: PhaserType.GameObjects.Image;
    private trail!: PhaserType.GameObjects.Graphics;
    private plate!: PhaserType.GameObjects.Image;
    private subPlate!: PhaserType.GameObjects.Container;
    private subText!: PhaserType.GameObjects.Text;
    private banner!: PhaserType.GameObjects.Text;
    private lastKey = '';
    private stillFrames = 0;

    constructor() {
      super({ key: 'footebas-match' });
    }

    create() {
      paintStadium(this, theme, scale);
      const shadowKey = shadowTexture(this, theme);
      const initial = this.frame();
      initial.players.forEach((player) => {
        const shadow = this.add
          .image(0, 0, shadowKey)
          .setScale(scale)
          .setAlpha(theme.shadowAlpha)
          .setDepth(2);
        const sprite = this.add
          .image(
            0,
            0,
            playerTexture(
              this,
              theme,
              controller.colors[player.side],
              player.number,
            ),
          )
          .setOrigin(0.5, 1)
          .setScale(scale);
        this.shadows.push(shadow);
        this.players.push(sprite);
        this.numbers.push(player.number);
      });
      this.ballShadow = this.add
        .image(0, 0, shadowKey)
        .setScale(scale * 0.6)
        .setAlpha(theme.shadowAlpha)
        .setDepth(2);
      this.ball = this.add
        .image(0, 0, ballTexture(this, theme))
        .setScale(scale);
      this.trail = this.add.graphics().setDepth(3);
      cardTexture(this, theme, 'red');
      injuryTexture(this, theme);
      this.plate = this.add
        .image(0, 0, cardTexture(this, theme, 'yellow'))
        .setOrigin(0.5, 1)
        .setScale(scale * 1.5)
        .setDepth(300)
        .setVisible(false);
      this.subText = this.add
        .text(0, 0, '', {
          fontFamily: theme.fonts.plate,
          fontSize: `${Math.round(2.8 * unit)}px`,
          fontStyle: 'bold',
          color: theme.colors.plateInk,
        })
        .setOrigin(0.5);
      const plateBg = this.add
        .rectangle(0, 0, 18 * unit, 4.6 * unit, colorNumber(theme.colors.plate))
        .setStrokeStyle(scale, colorNumber(theme.colors.plateIn));
      this.subPlate = this.add
        .container(toX(50), toY(PITCH.bottom) - 4 * unit, [
          plateBg,
          this.subText,
        ])
        .setDepth(310)
        .setVisible(false);
      this.banner = this.add
        .text(toX(50), toY(PITCH.height / 2), 'GOL!', {
          fontFamily: theme.fonts.banner,
          fontSize: `${Math.round(9 * unit)}px`,
          fontStyle: 'bold',
          color: theme.colors.bannerInk,
          stroke: '#000000',
          strokeThickness: 2 * scale,
        })
        .setOrigin(0.5)
        .setDepth(400)
        .setVisible(false);
      this.apply(initial);
      controller.onReady?.();
    }

    override update(_time: number, delta: number) {
      advanceController(controller, delta);
      const key = `${controller.step}:${controller.progress}`;
      if (key === this.lastKey) {
        // Two identical frames in a row: rendered and settled, so let the
        // loop sleep until React wakes it with a new step.
        this.stillFrames += 1;
        if (this.stillFrames === 2) controller.onSettled?.();
        return;
      }
      this.stillFrames = 0;
      this.lastKey = key;
      this.apply(this.frame());
    }

    private frame(): StageFrame {
      return sampleStage(
        controller.choreography,
        controller.step,
        controller.progress,
      );
    }

    private apply(frame: StageFrame) {
      frame.players.forEach((player, index) => {
        const sprite = this.players[index];
        const shadow = this.shadows[index];
        if (!sprite || !shadow) return;
        if (this.numbers[index] !== player.number) {
          this.numbers[index] = player.number;
          sprite.setTexture(
            playerTexture(
              this,
              theme,
              controller.colors[player.side],
              player.number,
            ),
          );
        }
        const celebrating =
          frame.overlay?.kind === 'goal' &&
          frame.overlay.playerKey === player.key;
        const hop = celebrating
          ? Math.abs(Math.sin(frame.progress * 40)) *
            2 *
            unit *
            frame.celebration
          : 0;
        const x = toX(player.x);
        const y = toY(player.y);
        sprite
          .setPosition(x, y - hop)
          .setScale(scale * depthScale(player.y))
          .setDepth(10 + player.y)
          .setVisible(player.visible);
        shadow.setPosition(x, y).setVisible(player.visible);
      });

      const ballX = toX(frame.ball.x);
      const ballY = toY(frame.ball.y);
      this.ballShadow.setPosition(ballX, ballY + scale);
      this.ballShadow.setAlpha(
        theme.shadowAlpha * (1 - frame.ball.height * 0.6),
      );
      this.ball
        .setPosition(ballX, ballY - frame.ball.height * 6 * unit)
        .setDepth(frame.ball.height > 0.2 ? 250 : 10.5 + frame.ball.y);

      this.trail.clear();
      if (frame.shotFrom) {
        this.trail.fillStyle(colorNumber(theme.colors.trail), 0.85);
        const fromX = toX(frame.shotFrom.x);
        const fromY = toY(frame.shotFrom.y);
        const dots = 10;
        for (let dot = 0; dot < dots; dot += 1) {
          const t = dot / dots;
          this.trail.fillRect(
            fromX + (ballX - fromX) * t - scale / 2,
            fromY + (ballY - fromY) * t - scale / 2,
            scale,
            scale,
          );
        }
      }

      const overlay = frame.overlay;
      const target =
        overlay && 'playerKey' in overlay
          ? frame.players.find((player) => player.key === overlay.playerKey)
          : undefined;
      if (target && (overlay?.kind === 'card' || overlay?.kind === 'injury')) {
        this.plate
          .setTexture(
            overlay.kind === 'card'
              ? cardTexture(this, theme, overlay.card)
              : injuryTexture(this, theme),
          )
          .setPosition(
            toX(target.x),
            toY(target.y) - (spriteHeight + 3) * scale,
          )
          .setVisible(true);
      } else {
        this.plate.setVisible(false);
      }

      if (overlay?.kind === 'substitution') {
        this.subText.setText(`▲${overlay.inNumber}  ▼${overlay.outNumber}`);
        this.subPlate.setVisible(true);
      } else {
        this.subPlate.setVisible(false);
      }

      if (overlay?.kind === 'goal' && frame.celebration > 0) {
        this.banner
          .setColor(controller.colors[overlay.side])
          .setScale(0.6 + 0.4 * frame.celebration)
          .setAlpha(Math.min(1, frame.celebration * 2))
          .setVisible(true);
      } else {
        this.banner.setVisible(false);
      }
    }
  };
}
