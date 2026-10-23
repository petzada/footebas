import { countryName } from '@/lib/coach-profile';
import { flagCodeFor, flagFor } from '@/lib/country-flags';
import { cn } from '@/lib/utils';

/**
 * Country flag (ISO 3166-1 alpha-2): the pixel PNG when the sheet has one
 * (`lib/country-flags.ts`), a drawn pixel flag for the countries below, and
 * the ISO code on a stamp for everybody else. Always 3:2.
 */
export function CountryFlag({
  code,
  width = 24,
  className,
  decorative = false,
}: {
  code: string;
  /** Flag width in CSS pixels; height follows the 3:2 ratio. */
  width?: number;
  className?: string;
  /** Hide from assistive tech when the country is already named next to it. */
  decorative?: boolean;
}) {
  const height = Math.round((width * 2) / 3);
  const iso = flagCodeFor(code)?.toUpperCase() ?? code.toUpperCase();
  const alt = `Bandeira: ${countryName(iso)}`;
  const file = flagFor(code);
  const a11y = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': alt };

  if (file)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny pixel PNG, no optimizer needed
      <img
        src={file}
        width={width}
        height={height}
        alt={decorative ? '' : alt}
        {...(decorative ? { 'aria-hidden': true } : {})}
        draggable={false}
        style={{
          width,
          height,
          imageRendering: 'pixelated',
          outline: '1px solid var(--ink)',
        }}
        className={cn('shrink-0 object-cover', className)}
        data-testid="country-flag"
        data-flag="pixel"
      />
    );

  if (iso === 'BR')
    return (
      <svg
        viewBox="0 0 18 12"
        width={width}
        height={height}
        style={{ width, height, imageRendering: 'pixelated' }}
        shapeRendering="crispEdges"
        className={cn('px-border shrink-0', className)}
        data-testid="country-flag"
        data-flag="drawn"
        {...a11y}
      >
        {!decorative && <title>{alt}</title>}
        <rect width="18" height="12" fill="#009c3b" />
        <path d="M9 1 L16 6 L9 11 L2 6 Z" fill="#ffdf00" />
        <rect x="6" y="3" width="6" height="6" fill="#002776" />
        <rect x="7" y="4" width="4" height="4" fill="#002776" />
        <rect x="6" y="6" width="6" height="1" fill="#fff" />
      </svg>
    );

  return (
    <span
      style={{ width, height, lineHeight: `${height}px` }}
      className={cn(
        'px-border inline-block shrink-0 bg-chalk text-center font-pixel text-[.4rem] text-ink',
        className,
      )}
      data-testid="country-flag"
      data-flag="code"
      {...a11y}
    >
      {iso}
    </span>
  );
}
