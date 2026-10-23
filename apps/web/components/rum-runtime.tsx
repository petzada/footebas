'use client';

import { useEffect } from 'react';
import { startRum } from '@/lib/rum';

/** Starts real-user metrics on every page (landing and game). */
export function RumRuntime() {
  useEffect(() => {
    startRum(process.env.NEXT_PUBLIC_API_URL);
  }, []);
  return null;
}
