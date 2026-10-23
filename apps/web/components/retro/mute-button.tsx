'use client';

import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

/** Mute toggle for the interface sounds; the choice is remembered. */
export function MuteButton({
  className,
  compact = false,
}: {
  className?: string;
  /** Icon only (header): the state stays in the accessible name. */
  compact?: boolean;
}) {
  const { muted, toggle, play } = useSound();
  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label={muted ? 'Som desligado' : 'Som ligado'}
      title={muted ? 'Ligar som' : 'Desligar som'}
      className={cn(
        'btn-px btn-board inline-flex min-h-10 items-center gap-2 text-[.6rem]',
        compact ? 'size-9 justify-center px-0 sm:size-10' : 'px-3',
        className,
      )}
      onClick={() => {
        const next = toggle();
        if (!next) play('click');
      }}
    >
      {muted ? (
        <SpeakerSlash weight="fill" aria-hidden="true" />
      ) : (
        <SpeakerHigh weight="fill" aria-hidden="true" />
      )}
      {!compact && (
        <span className="hidden sm:inline">{muted ? 'Mudo' : 'Som'}</span>
      )}
    </button>
  );
}
