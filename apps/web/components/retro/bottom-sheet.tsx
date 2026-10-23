'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

/**
 * Modal sheet in the retro style: ~3/4 of the screen rising from the bottom
 * on phones, a centered dialog from `sm` up. Traps focus, Esc closes and the
 * focus goes back to whatever opened it. `footer` stays pinned at the bottom.
 * `tone="light"` is the paper sheet used by paywalls and the PIX checkout:
 * white surface, dark text, the same pixel border and title font.
 */
export function BottomSheet({
  title,
  onClose,
  children,
  footer,
  testId = 'bottom-sheet',
  className,
  tone = 'board',
}: {
  title: React.ReactNode;
  onClose(): void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  testId?: string;
  className?: string;
  tone?: 'board' | 'light';
}) {
  const light = tone === 'light';
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // Portaled to <body> so an animated (transformed) ancestor never breaks
  // `position: fixed`; the opener is captured before the first paint.
  const host = useSyncExternalStore(
    () => () => {},
    () => document.body,
    () => null,
  );
  useEffect(() => {
    opener.current = document.activeElement;
    return () => {
      const target = opener.current;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, []);

  useEffect(() => {
    if (!host) return;
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [host]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !ref.current) return;
    const nodes = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!host) return null;
  return createPortal(
    <>
      <div
        data-testid={`${testId}-backdrop`}
        className="fixed inset-0 z-40 bg-ink/60"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        data-tone={tone}
        className={cn(
          light ? 'px-border bg-white text-ink' : 'panel-board',
          'px-rise fixed inset-x-0 bottom-0 z-50 flex h-[75dvh] w-full min-w-0 flex-col overflow-hidden',
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[85dvh] sm:w-[min(32rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2',
          className,
        )}
        onKeyDown={onKeyDown}
      >
        <header
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 p-4 pb-2 sm:p-5 sm:pb-2',
            light && 'border-b-2 border-ink/10',
          )}
        >
          <h2
            id={titleId}
            className={cn(
              'min-w-0 flex-1 text-sm leading-relaxed break-words sm:text-base',
              light ? 'font-pixel text-ink' : 'led',
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            data-autofocus
            className="btn-px btn-chalk inline-flex size-11 shrink-0 items-center justify-center"
            onClick={onClose}
          >
            <X weight="bold" aria-hidden="true" />
          </button>
        </header>
        <div
          className={cn(
            'min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-2 sm:px-5',
            // Lets a sticky action inside the body (PIX "Pagar depois") sit
            // on the bottom edge even when the content is short.
            light && 'flex flex-col',
          )}
        >
          {children}
        </div>
        {footer && (
          <footer
            className={cn(
              'grid shrink-0 gap-2 border-t-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5',
              light ? 'border-ink/10 bg-white' : 'border-chalk/20 bg-ink/40',
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </>,
    host,
  );
}
