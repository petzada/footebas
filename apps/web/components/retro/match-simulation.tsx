import { ClubEmblem } from '@/components/club-emblem';

/**
 * "Resultado instantâneo" loading: a pixel pitch where a ball bounces
 * between the two goals while the server simulates the match. Pure CSS (no
 * Phaser/Three), shown only while the command is in flight and never
 * delaying the result. With `prefers-reduced-motion` the ball stands still
 * and the text carries the state.
 */
export function MatchSimulation({
  home,
  away,
}: {
  home: string;
  away: string;
}) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Simulando a partida"
      data-testid="match-simulation"
      className="panel-board mx-auto grid w-full max-w-3xl gap-3 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="led text-[.55rem] tracking-[.2em]">Simulando</span>
        <span className="font-pixel text-[.5rem] text-chalk/80">
          resultado instantâneo
        </span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <ClubEmblem name={home} size={40} decorative />
        <div
          aria-hidden="true"
          className="pitch px-border relative h-24 overflow-hidden sm:h-28"
        >
          <span className="sim-ball absolute top-1/2 left-2 size-3 -translate-y-1/2 bg-chalk shadow-[2px_2px_0_0_rgb(0_0_0/0.4)]" />
        </div>
        <ClubEmblem name={away} size={40} decorative />
      </div>
      <p className="text-center font-pixel text-[.55rem] text-chalk">
        <span aria-hidden="true" className="blink">
          ▶{' '}
        </span>
        Bola rolando… o placar sai em instantes.
      </p>
    </section>
  );
}
