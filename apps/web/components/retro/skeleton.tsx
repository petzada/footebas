import { cn } from '@/lib/utils';

/**
 * Loading placeholder in the Futebol Retrô look: a chalk panel with
 * "unlit" scoreboard bars that blink in steps (no shimmer gradient). The
 * message stays for assistive tech and for `prefers-reduced-motion`, where
 * the bars simply stop blinking. Screens show it instead of a bare sentence
 * so the layout keeps its shape while the data arrives.
 */
export function ScreenSkeleton({
  label,
  rows = 4,
  className,
}: {
  /** What is loading, e.g. "Abrindo o mercado…". */
  label: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="screen-skeleton"
      className={cn('grid gap-3', className)}
    >
      <div className="panel-board grid grid-cols-3 gap-2 p-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="grid gap-1.5">
            <SkeletonBar className="h-2 w-10 bg-chalk/30" />
            <SkeletonBar className="h-4 w-16 bg-bulb/40" delay={item} />
          </div>
        ))}
      </div>
      <div className="panel grid gap-3 p-4">
        <SkeletonBar className="h-3 w-32 bg-ink/25" />
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonBar
            key={index}
            className={cn('h-9', index % 2 ? 'w-5/6' : 'w-full')}
            delay={index}
          />
        ))}
      </div>
      <p className="flex items-center justify-center gap-2 font-pixel text-[.55rem] text-chalk drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]">
        <span aria-hidden="true" className="blink">
          ▶
        </span>
        {label}
      </p>
    </div>
  );
}

function SkeletonBar({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('skeleton-bar block bg-ink/15', className)}
      style={{ animationDelay: `${String(delay * 120)}ms` }}
    />
  );
}
