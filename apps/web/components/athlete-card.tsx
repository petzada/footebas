import { emblemSpec, type EmblemInput } from '@/components/club-emblem';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { PixelCard, PixelHeart, PixelStar } from '@/components/retro/sprites';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { PlayerView } from '@/lib/career-api';
import { cn } from '@/lib/utils';

export interface PotentialBand {
  readonly min: number;
  readonly max: number;
  readonly label: string;
}

/**
 * Potential as an estimated range (ADR 0010 §5): the scouting label widens
 * or narrows a band around the current strength; the exact value stays
 * hidden. Pure and clamped to 1–99.
 */
export function potentialBand(
  strength: number,
  potential: PlayerView['scoutingEstimates']['potential'],
  age: number,
): PotentialBand {
  const youth = age <= 23 ? 1 : age <= 29 ? 0.5 : 0;
  const spread: Record<typeof potential, readonly [number, number]> = {
    limitado: [-2, 3],
    bom: [1, 8],
    alto: [4, 15],
  };
  const [low, high] = spread[potential];
  const clamp = (value: number) => Math.max(1, Math.min(99, Math.round(value)));
  return {
    min: clamp(strength + low * youth),
    max: clamp(strength + high * (0.5 + youth / 2)),
    label: `Potencial ${potential}`,
  };
}

/** Short tag for the sticker header. */
export function positionTag(position: string): string {
  return position.slice(0, 3).toUpperCase();
}

/**
 * Figurinha: sticker card of an athlete with pixel portrait, position,
 * strength bar, trait seals and the potential band. Club colors come from
 * the (generic) emblem spec.
 */
export function AthleteCard({
  player,
  club,
  compact = false,
  selected = false,
  className,
}: {
  player: PlayerView;
  club: EmblemInput;
  compact?: boolean;
  selected?: boolean;
  className?: string;
}) {
  const colors = emblemSpec(club);
  const band = potentialBand(
    player.strength,
    player.scoutingEstimates.potential,
    player.age,
  );
  const unavailable = player.injuryRounds > 0 || player.suspended;
  return (
    <article
      aria-label={`${player.name}, ${player.primaryPosition}, força ${player.strength}`}
      data-selected={selected || undefined}
      className={cn(
        'sticker relative grid gap-2 p-2 pt-0',
        selected && 'outline outline-4 outline-bulb',
        className,
      )}
    >
      {/* Club stripe: artwork colors from the generic emblem. */}
      <div
        aria-hidden="true"
        className="-mx-2 flex items-center justify-between px-2 py-1 font-pixel text-[.55rem]"
        style={{
          background: `repeating-linear-gradient(90deg, ${colors.primary} 0 12px, ${colors.secondary} 12px 16px)`,
          color: colors.ink,
        }}
      >
        <span className="bg-chalk px-1 text-ink">
          {positionTag(player.primaryPosition)}
        </span>
        <span className="bg-ink px-1 text-chalk">#{player.shirt}</span>
      </div>
      <div className="flex items-center gap-2">
        <PixelAvatar
          seed={`atleta-${player.id}`}
          size={compact ? 40 : 56}
          className="px-border bg-chalk"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold leading-tight">
            {player.name}
          </h3>
          <p className="truncate text-[.7rem] text-muted-foreground">
            {player.age} anos · {player.primaryPosition}
            {player.secondaryPositions.length > 0 &&
              ` / ${player.secondaryPositions.join(', ')}`}
          </p>
        </div>
        <span className="led bg-board px-1.5 py-1 text-base" aria-hidden="true">
          {player.strength}
        </span>
      </div>
      <dl className="grid gap-1 text-[.65rem]">
        <div className="grid grid-cols-[3.2rem_1fr] items-center gap-2">
          <dt className="font-pixel text-[.5rem] uppercase">Força</dt>
          <dd>
            <Progress
              value={player.strength}
              aria-label={`Força: ${player.strength}`}
            />
          </dd>
        </div>
        <div className="grid grid-cols-[3.2rem_1fr] items-center gap-2">
          <dt className="font-pixel text-[.5rem] uppercase">Forma</dt>
          <dd>
            <Progress
              value={player.condition}
              tone={player.condition < 60 ? 'red' : 'grass'}
              aria-label={`Condição: ${player.condition}%`}
            />
          </dd>
        </div>
        <div className="grid grid-cols-[3.2rem_1fr] items-center gap-2">
          <dt className="font-pixel text-[.5rem] uppercase">Potenc.</dt>
          <dd
            className="relative"
            aria-label={`${band.label}: faixa estimada entre ${band.min} e ${band.max}`}
            data-potential-min={band.min}
            data-potential-max={band.max}
          >
            <div className="bar-px" data-tone="bulb" aria-hidden="true">
              <span
                className="absolute top-0 h-full opacity-90"
                style={{
                  left: `${band.min}%`,
                  width: `${Math.max(2, band.max - band.min)}%`,
                  backgroundImage:
                    'repeating-linear-gradient(135deg, var(--bulb) 0 3px, var(--ink) 3px 5px)',
                }}
              />
            </div>
            <span className="mt-0.5 block font-pixel text-[.5rem] uppercase">
              ≈ {band.min}–{band.max} · estimativa
            </span>
          </dd>
        </div>
      </dl>
      {!compact && (
        <ul className="flex flex-wrap gap-1" aria-label="Características">
          {player.traits.slice(0, 3).map((trait) => (
            <li key={trait}>
              <Badge variant="outline">
                <PixelStar size={8} />
                {trait}
              </Badge>
            </li>
          ))}
          {player.scoutingEstimates.bigMatches === 'decisivo' && (
            <li>
              <Badge variant="bulb">Decisivo</Badge>
            </li>
          )}
          {player.morale >= 80 && (
            <li>
              <Badge variant="secondary">
                <PixelHeart size={8} />
                Moral alta
              </Badge>
            </li>
          )}
        </ul>
      )}
      {unavailable && (
        <p className="flex items-center gap-1.5 font-pixel text-[.5rem] uppercase text-destructive">
          <PixelCard tone="red" size={10} />
          {player.suspended
            ? 'Suspenso'
            : `Lesionado · ${player.injuryRounds} rodada(s)`}
        </p>
      )}
    </article>
  );
}
