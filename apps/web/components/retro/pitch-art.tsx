import { cn } from '@/lib/utils';

/** Pitch proportions (metres): FIFA 68 × 105, portrait, attacking upwards. */
export const PITCH_WIDTH = 68;
export const PITCH_HEIGHT = 105;
export const PITCH_VIEWBOX = `0 0 ${String(PITCH_WIDTH)} ${String(PITCH_HEIGHT)}`;

const CHALK = 'rgb(244 239 226 / 0.88)';
const STRIPES = 10;

/**
 * Chalk drawing of a football pitch as a responsive SVG (ADR 0012: pixel
 * grass stripes, white lines, no 3D). Purely decorative: it sits behind the
 * player tokens, which are HTML buttons positioned in the same box.
 */
export function PitchArt({ className }: { className?: string }) {
  const stripe = PITCH_HEIGHT / STRIPES;
  const line = 0.7;
  return (
    <svg
      viewBox={PITCH_VIEWBOX}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
      className={cn('pointer-events-none block size-full', className)}
    >
      {Array.from({ length: STRIPES }, (_, index) => (
        <rect
          key={index}
          x={0}
          y={index * stripe}
          width={PITCH_WIDTH}
          height={stripe}
          fill={index % 2 ? 'var(--grass)' : 'var(--grass-light)'}
        />
      ))}
      <g fill="none" stroke={CHALK} strokeWidth={line}>
        {/* Touchlines and halfway line. */}
        <rect x={1} y={1} width={PITCH_WIDTH - 2} height={PITCH_HEIGHT - 2} />
        <line
          x1={1}
          y1={PITCH_HEIGHT / 2}
          x2={PITCH_WIDTH - 1}
          y2={PITCH_HEIGHT / 2}
        />
        <circle cx={PITCH_WIDTH / 2} cy={PITCH_HEIGHT / 2} r={9.15} />
        {/* Penalty and goal areas, both ends. */}
        <rect x={13.85} y={1} width={40.3} height={16.5} />
        <rect x={24.85} y={1} width={18.3} height={5.5} />
        <rect x={13.85} y={PITCH_HEIGHT - 17.5} width={40.3} height={16.5} />
        <rect x={24.85} y={PITCH_HEIGHT - 6.5} width={18.3} height={5.5} />
        {/* Penalty arcs. */}
        <path d="M 26.8 17.5 A 9.15 9.15 0 0 0 41.2 17.5" />
        <path d="M 26.8 87.5 A 9.15 9.15 0 0 1 41.2 87.5" />
        {/* Corner arcs. */}
        <path d="M 1 3 A 2 2 0 0 0 3 1" />
        <path d="M 65 1 A 2 2 0 0 0 67 3" />
        <path d="M 1 102 A 2 2 0 0 1 3 104" />
        <path d="M 67 102 A 2 2 0 0 0 65 104" />
      </g>
      <g fill={CHALK}>
        <rect x={33.5} y={11.5} width={1} height={1} />
        <rect x={33.5} y={92.5} width={1} height={1} />
        <rect x={33.5} y={52} width={1} height={1} />
        {/* Goals. */}
        <rect x={30.3} y={0} width={7.4} height={1.2} opacity={0.9} />
        <rect
          x={30.3}
          y={PITCH_HEIGHT - 1.2}
          width={7.4}
          height={1.2}
          opacity={0.9}
        />
      </g>
    </svg>
  );
}
