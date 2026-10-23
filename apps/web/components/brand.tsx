import { SoccerBall } from '@phosphor-icons/react';

export function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="btn-grass grid size-9 place-items-center rounded-xl">
        <SoccerBall weight="fill" />
      </span>
      <span className="font-display text-2xl font-bold uppercase tracking-tight">
        Footebas
      </span>
    </div>
  );
}
