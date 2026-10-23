import { PixelBall } from '@/components/retro/sprites';

/** Pixel wordmark: ball sprite on a scoreboard tile plus the name. */
export function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="px-border grid size-9 place-items-center bg-board">
        <PixelBall size={22} />
      </span>
      <span className="font-pixel text-sm text-chalk sm:text-base">
        Footebas
      </span>
    </div>
  );
}
