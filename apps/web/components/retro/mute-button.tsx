'use client';

import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

/** Mute toggle for the interface sounds; the choice is remembered. */
export function MuteButton({ className }: { className?: string }) {
  const { muted, toggle, play } = useSound();
  return (
    <button
      type="button"
      aria-pressed={!muted}
      aria-label={muted ? 'Som desligado' : 'Som ligado'}
      title={muted ? 'Ligar som' : 'Desligar som'}
      className={cn(
        'btn-px btn-board inline-flex min-h-10 items-center gap-2 px-3 text-[.6rem]',
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
      <span className="hidden sm:inline">{muted ? 'Mudo' : 'Som'}</span>
    </button>
  );
}
