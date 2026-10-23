// Pixel-art flags cut from the owner's sheet (same idea as `club-crests.ts`).
// Codes are ISO 3166-1 alpha-2; files live in `public/flags/<code>.png`
// (lower-case). Countries without a file get the drawn fallback in
// `components/country-flag.tsx`.
const AVAILABLE = new Set<string>([
  'ar',
  'au',
  'br',
  'ca',
  'cn',
  'de',
  'fr',
  'gb',
  'id',
  'in',
  'it',
  'jp',
  'kr',
  'mx',
  'ru',
  'sa',
  'tr',
  'us',
  'ye',
  'za',
]);

/** Lower-case ISO code, or undefined when the value is not an alpha-2 code. */
export function flagCodeFor(code: string): string | undefined {
  const value = code.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value.toLowerCase() : undefined;
}

/** Public path of the flag PNG, or undefined when the country has none. */
export function flagFor(code: string): string | undefined {
  const key = flagCodeFor(code);
  return key && AVAILABLE.has(key) ? `/flags/${key}.png` : undefined;
}
