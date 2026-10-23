import { cn } from '@/lib/utils';

/** Wordmark: the name alone, in the pixel font (no symbol). */
export function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'font-pixel text-chalk',
        size === 'lg'
          ? 'text-2xl drop-shadow-[0_3px_0_rgb(21_32_26)] sm:text-3xl'
          : 'text-sm sm:text-base',
      )}
    >
      Footebas
    </span>
  );
}
