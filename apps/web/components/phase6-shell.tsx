'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CalendarDots,
  DotsThreeOutline,
  SignOut,
  SoccerBall,
  WifiHigh,
  WifiSlash,
} from '@phosphor-icons/react';
import { Brand } from '@/components/brand';
import { ClubEmblem } from '@/components/club-emblem';
import { CoachAvatar } from '@/components/coach-avatar';
import {
  GameMenu,
  barDestinations,
  labels,
  menuBadges,
  menuGroups,
} from '@/components/game-menu';
import { MuteButton } from '@/components/retro/mute-button';
import { ScreenTransition } from '@/components/retro/screen-transition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { CareerView, Screen } from '@/lib/career-api';
import { personalityLabel } from '@/lib/coach-profile';
import { cn } from '@/lib/utils';

type CommandState = 'idle' | 'pending' | 'duplicate' | 'success';

export function Phase6Shell({
  screen,
  setScreen,
  career,
  commandState,
  onSignOut,
  onHome,
  immersive = false,
  children,
}: {
  screen: Screen;
  setScreen(value: Screen): void;
  career: CareerView;
  commandState: CommandState;
  /** Shown only when there is a real account session to end. */
  onSignOut?: () => void;
  /** Leaves the career for the Início screen (new or saved careers). */
  onHome?: () => void;
  /**
   * Live match (docs/09 decision 19): the bottom bar hides and comes back
   * when the user scrolls down or changes screen.
   */
  immersive?: boolean;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const barVisible = useBarVisibility(immersive, screen);

  // Central and Mapa already show the next match and the advance button.
  const showRail = screen !== 'central' && screen !== 'map';

  const navigate = (destination: Screen) => {
    setScreen(destination);
    setMenuOpen(false);
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={cn(
        'mx-auto min-h-dvh max-w-[110rem] pb-24 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:pb-0',
        showRail && 'xl:grid-cols-[16rem_minmax(0,1fr)_19rem]',
      )}
    >
      <DesktopSidebar career={career} screen={screen} navigate={navigate} />
      <main
        id="conteudo-principal"
        aria-busy={commandState === 'pending'}
        className="min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-6"
      >
        <header
          data-testid="shell-header"
          className={cn(
            'panel-board mb-5 flex min-h-14 items-center justify-between gap-3 px-3 py-2 sm:px-4',
            // Live match (decision 19): the app header stays pinned on top.
            immersive && 'sticky top-0 z-30 mb-3',
          )}
        >
          {/* Screen title stays for assistive tech; visually the header is
              only the crest, the coach and three small icons. */}
          <h1 className="sr-only">{labels[screen]}</h1>
          <div className="flex min-w-0 items-center gap-2.5">
            <ClubEmblem name={career.club} size={40} />
            <p className="led min-w-0 truncate text-[.6rem] leading-relaxed sm:text-sm">
              {career.coach}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <MuteButton compact />
            {onHome && (
              <Button
                variant="outline"
                size="icon"
                className="size-9 sm:size-10"
                aria-label="Voltar ao início"
                title="Voltar ao início"
                onClick={onHome}
              >
                <SoccerBall weight="fill" />
              </Button>
            )}
            {onSignOut && (
              <Button
                variant="outline"
                size="icon"
                className="size-9 sm:size-10"
                aria-label="Sair"
                title="Sair"
                onClick={onSignOut}
              >
                <SignOut weight="bold" />
              </Button>
            )}
          </div>
        </header>
        <CommandAnnouncer state={commandState} />
        <ScreenTransition id={screen}>{children}</ScreenTransition>
      </main>
      {showRail && <DesktopRail career={career} navigate={navigate} />}
      {barVisible && (
        <MobileNavigation
          screen={screen}
          career={career}
          open={menuOpen}
          setOpen={setMenuOpen}
          navigate={navigate}
          triggerRef={menuTrigger}
        />
      )}
      <GameMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        screen={screen}
        career={career}
        navigate={navigate}
        onHome={onHome}
        onSignOut={onSignOut}
        returnFocusTo={menuTrigger}
      />
    </div>
  );
}

/**
 * Bottom bar visibility: always on, except in immersive mode, where it hides
 * until the user scrolls down (24px past the last position) or the screen
 * changes.
 */
function useBarVisibility(immersive: boolean, screen: Screen): boolean {
  const [revealed, setRevealed] = useState(false);
  const [seen, setSeen] = useState({ immersive, screen });
  const lastY = useRef(0);

  // Derived during render (no setState in effects): entering immersive mode
  // hides the bar again; changing screen while immersive brings it back.
  if (seen.immersive !== immersive || seen.screen !== screen) {
    setSeen({ immersive, screen });
    setRevealed(seen.immersive === immersive && immersive);
  }

  useEffect(() => {
    if (!immersive || revealed) return;
    lastY.current = globalThis.scrollY ?? 0;
    const onScroll = () => {
      const y = globalThis.scrollY ?? 0;
      if (y > lastY.current + 24) setRevealed(true);
      lastY.current = y;
    };
    globalThis.addEventListener('scroll', onScroll, { passive: true });
    return () => globalThis.removeEventListener('scroll', onScroll);
  }, [immersive, revealed]);

  return !immersive || revealed;
}

export function PwaRuntime() {
  const [network, setNetwork] = useState<'online' | 'offline' | 'reconnecting'>(
    'online',
  );

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    const markOffline = () => setNetwork('offline');
    const reconnect = () => {
      setNetwork('reconnecting');
      globalThis.setTimeout(() => setNetwork('online'), 700);
    };
    if (!navigator.onLine) markOffline();
    globalThis.addEventListener('offline', markOffline);
    globalThis.addEventListener('online', reconnect);
    return () => {
      globalThis.removeEventListener('offline', markOffline);
      globalThis.removeEventListener('online', reconnect);
    };
  }, []);

  if (network === 'online') return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="ticker fixed inset-x-3 top-3 z-50 mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3 text-[.6rem] text-chalk"
    >
      <span className="flex items-center gap-2 font-medium">
        {network === 'offline' ? <WifiSlash /> : <WifiHigh />}
        {network === 'offline'
          ? 'Sem conexão. Nada se perde: sua carreira fica salva no servidor.'
          : 'Conexão voltou. Sincronizando a última jogada…'}
      </span>
      {network === 'offline' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setNetwork(navigator.onLine ? 'reconnecting' : 'offline')
          }
        >
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

function DesktopSidebar({
  career,
  screen,
  navigate,
}: {
  career: CareerView;
  screen: Screen;
  navigate(value: Screen): void;
}) {
  const badges = menuBadges(career);
  return (
    <aside className="sticky top-0 hidden h-dvh border-r-4 border-ink bg-board p-4 text-chalk lg:flex lg:flex-col">
      <Brand />
      <a
        href="#conteudo-principal"
        className="sr-only rounded-md bg-background p-2 focus:not-sr-only"
      >
        Pular para o conteúdo
      </a>
      <nav
        aria-label="Navegação principal desktop"
        className="mt-7 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
      >
        {menuGroups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`desktop-${group.id}`}
            className="mb-3 flex flex-col gap-1"
          >
            <p
              id={`desktop-${group.id}`}
              className="px-3 pb-1 font-pixel text-[.5rem] text-bulb"
            >
              {group.label}
            </p>
            {group.items.map(([id, label, Icon]) => (
              <Button
                key={id}
                variant={screen === id ? 'outline' : 'ghost'}
                className="min-h-10 justify-between text-[.6rem]"
                aria-current={screen === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <span className="flex items-center gap-2">
                  <Icon data-icon="inline-start" weight="fill" />
                  {label}
                </span>
                {badges[id] && (
                  <>
                    <span className="sr-only">({badges[id]})</span>
                    <Badge aria-hidden="true">{badges[id]}</Badge>
                  </>
                )}
              </Button>
            ))}
          </section>
        ))}
      </nav>
      <Separator className="my-4" />
      <div className="flex min-w-0 items-center gap-3">
        {career.coachProfile && (
          <CoachAvatar avatar={career.coachProfile.avatar} size={44} />
        )}
        <div className="min-w-0">
          <p className="text-xs text-chalk/70">
            Treinador
            {career.coachProfile &&
              ` · ${personalityLabel(career.coachProfile.personality)}`}
          </p>
          <p className="truncate font-pixel text-[.6rem]">{career.coach}</p>
        </div>
      </div>
    </aside>
  );
}

function DesktopRail({
  career,
  navigate,
}: {
  career: CareerView;
  navigate(value: Screen): void;
}) {
  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(career.world.finances.cash);
  return (
    <aside className="sticky top-0 hidden h-dvh border-l-4 border-ink bg-board p-5 text-chalk xl:flex xl:flex-col xl:gap-5">
      <section aria-labelledby="proximo-jogo">
        <p className="led text-[.5rem] tracking-[.2em]">Próximo jogo</p>
        <h2 id="proximo-jogo" className="mt-1 font-pixel text-[.65rem]">
          {career.club} × {career.opponent.club}
        </h2>
        <p className="mt-1 text-sm text-chalk/70">{career.opponent.report}</p>
      </section>
      <Separator />
      <section aria-labelledby="central-rapida" className="flex flex-col gap-2">
        <h2 id="central-rapida" className="font-pixel text-[.6rem]">
          Central rápida
        </h2>
        <Button
          variant="outline"
          className="justify-between"
          onClick={() => navigate('inbox')}
        >
          Caixa de entrada
          <Badge>{career.world.news.length}</Badge>
        </Button>
        <Button
          variant="outline"
          className="justify-between"
          onClick={() => navigate('calendar')}
        >
          Ver calendário
          <CalendarDots data-icon="inline-end" />
        </Button>
        <Button
          variant="outline"
          className="justify-between"
          onClick={() => navigate('finance')}
        >
          Caixa do clube
          <span className="font-pixel">{money}</span>
        </Button>
      </section>
      <div className="panel mt-auto p-4">
        <p className="font-pixel text-[.5rem] text-muted-foreground">
          Ritmo da carreira
        </p>
        <p className="mt-1 font-pixel text-2xl">{career.round}</p>
        <p className="text-sm text-muted-foreground">rodadas disputadas</p>
      </div>
    </aside>
  );
}

function MobileNavigation({
  screen,
  career,
  open,
  setOpen,
  navigate,
  triggerRef,
}: {
  screen: Screen;
  career: CareerView;
  open: boolean;
  setOpen(value: boolean): void;
  navigate(value: Screen): void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const badges = menuBadges(career);
  const pending = Object.keys(badges).filter(
    (id) => !barDestinations.some(([bar]) => bar === id),
  ).length;
  const itemClass =
    'relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-0.5 font-pixel text-[.45rem] leading-none';
  return (
    <nav
      aria-label="Navegação principal mobile"
      className="panel-wood px-rise fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 gap-1 px-1.5 py-1.5 lg:hidden"
    >
      {barDestinations.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          aria-current={screen === id ? 'page' : undefined}
          className={cn(
            itemClass,
            screen === id ? 'bg-board text-bulb' : 'text-chalk',
          )}
          onClick={() => navigate(id)}
        >
          <Icon
            className="size-6 drop-shadow-[0_2px_0_rgb(0_0_0/0.45)]"
            weight="fill"
            aria-hidden="true"
          />
          {label}
          {badges[id] && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 size-2 rounded-full bg-bulb"
            />
          )}
        </button>
      ))}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(itemClass, open ? 'bg-board text-bulb' : 'text-chalk')}
        onClick={() => setOpen(!open)}
      >
        <DotsThreeOutline
          className="size-6 drop-shadow-[0_2px_0_rgb(0_0_0/0.45)]"
          weight="fill"
          aria-hidden="true"
        />
        Menu
        {pending > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 size-2 rounded-full bg-bulb"
          />
        )}
      </button>
    </nav>
  );
}

function CommandAnnouncer({ state }: { state: CommandState }) {
  return (
    <p aria-live="polite" className="sr-only">
      {state === 'pending'
        ? 'Jogada em processamento.'
        : state === 'duplicate'
          ? 'Comando já está em andamento e não será duplicado.'
          : state === 'success'
            ? 'Jogada confirmada.'
            : ''}
    </p>
  );
}
