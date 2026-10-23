'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const media = globalThis.matchMedia?.(QUERY);
  if (!media?.addEventListener) return () => undefined;
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const read = () => globalThis.matchMedia?.(QUERY)?.matches ?? false;
// On the server there is no preference: render still, hydrate with the real one.
const readServer = () => true;

/** Live `prefers-reduced-motion` (unlike a value cached at module load). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, read, readServer);
}
