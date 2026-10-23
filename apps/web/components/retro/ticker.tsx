'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

export type TickerTone = 'info' | 'success' | 'error';

interface TickerMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: TickerTone;
}

interface TickerApi {
  /** Shows a scoreboard-style message for a few seconds. */
  announce(text: string, tone?: TickerTone): void;
}

const TickerContext = createContext<TickerApi>({ announce: () => undefined });

export function useTicker(): TickerApi {
  return useContext(TickerContext);
}

const DURATION = 5200;

/**
 * Letreiro: toast messages drawn as a stadium ticker. One at a time, read
 * by assistive tech through a polite live region, closed on tap.
 */
export function TickerProvider({
  children,
  duration = DURATION,
}: {
  children: ReactNode;
  duration?: number;
}) {
  const [current, setCurrent] = useState<TickerMessage | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { play } = useSound();

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCurrent(null);
  }, []);

  const announce = useCallback(
    (text: string, tone: TickerTone = 'info') => {
      counter.current += 1;
      setCurrent({ id: counter.current, text, tone });
      play(
        tone === 'error' ? 'error' : tone === 'success' ? 'confirm' : 'click',
      );
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCurrent(null), duration);
    },
    [duration, play],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const api = useMemo(() => ({ announce }), [announce]);

  return (
    <TickerContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-[max(.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-xl"
      >
        {current && (
          <button
            type="button"
            key={current.id}
            data-tone={current.tone}
            aria-label={`Fechar aviso: ${current.text}`}
            className={cn(
              'ticker px-rise pointer-events-auto block w-full py-2.5 text-left text-[.6rem] leading-relaxed',
              current.tone === 'error' && 'text-chalk',
            )}
            onClick={dismiss}
          >
            <span className="ticker-text">
              {current.tone === 'error'
                ? '!! '
                : current.tone === 'success'
                  ? '** '
                  : '>> '}
              {current.text}
            </span>
          </button>
        )}
      </div>
    </TickerContext.Provider>
  );
}
