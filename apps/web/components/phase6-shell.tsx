'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Bank,
  Bell,
  Briefcase,
  CalendarDots,
  ChartLineUp,
  ClockCounterClockwise,
  DotsThree,
  House,
  ListNumbers,
  MapTrifold,
  Ranking,
  SignOut,
  SoccerBall,
  Storefront,
  Strategy,
  Trophy,
  UsersThree,
  WifiHigh,
  WifiSlash,
} from '@phosphor-icons/react';
import { Brand } from '@/components/brand';
import { ClubEmblem } from '@/components/club-emblem';
import { CoachAvatar } from '@/components/coach-avatar';
import { MuteButton } from '@/components/retro/mute-button';
import { ScreenTransition } from '@/components/retro/screen-transition';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { CareerView, Screen } from '@/lib/career-api';
import { personalityLabel } from '@/lib/coach-profile';
import { cn } from '@/lib/utils';

type CommandState = 'idle' | 'pending' | 'duplicate' | 'success';

type Destination = readonly [Screen, string, typeof House];

/** The seven main areas of docs/09-telas-e-escopo.md, in order. */
export const mainDestinations = [
  ['central', 'Central', House],
  ['map', 'Mapa', MapTrifold],
  ['squad', 'Elenco', UsersThree],
  ['market', 'Mercado', Storefront],
  ['office', 'Escritório', Briefcase],
  ['season', 'Temporada', ChartLineUp],
  ['ranking', 'Ranking', Ranking],
] as const satisfies ReadonlyArray<Destination>;

/** Current screens that keep working until their own redesign. */
export const moreDestinations = [
  ['inbox', 'Caixa de entrada', Bell],
  ['calendar', 'Calendário', CalendarDots],
  ['tactics', 'Táticas', Strategy],
  ['table', 'Classificação', ListNumbers],
  ['competitions', 'Competições', Trophy],
  ['stadium', 'Estádio', SoccerBall],
  ['finance', 'Finanças', Bank],
  ['history', 'Histórico', ClockCounterClockwise],
] as const satisfies ReadonlyArray<Destination>;

const destinations: readonly Destination[] = [
  ...mainDestinations,
  ...moreDestinations,
];

const primaryMobile = mainDestinations.slice(0, 4);

const labels = Object.fromEntries(
  destinations.map(([id, label]) => [id, label]),
) as Record<Screen, string>;

export function Phase6Shell({
  screen,
  setScreen,
  career,
  commandState,
  onSignOut,
  onHome,
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
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

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
        <header className="panel-board mb-5 flex min-h-14 items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <ClubEmblem name={career.club} size={44} decorative />
            <div className="min-w-0">
              <p className="truncate font-pixel text-[.5rem] text-chalk/80">
                {career.club} · Rodada {career.round}
              </p>
              <h1 className="led truncate text-sm leading-relaxed sm:text-xl">
                {labels[screen]}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <MuteButton />
            {onHome && (
              <Button
                variant="outline"
                aria-label="Voltar ao início"
                title="Voltar ao início"
                onClick={onHome}
              >
                <SoccerBall data-icon="inline-start" />
                <span className="hidden sm:inline">Início</span>
              </Button>
            )}
            {onSignOut && (
              <Button variant="outline" onClick={onSignOut}>
                <SignOut data-icon="inline-start" />
                Sair
              </Button>
            )}
          </div>
        </header>
        <CommandAnnouncer state={commandState} />
        <ScreenTransition id={screen}>{children}</ScreenTransition>
      </main>
      {showRail && <DesktopRail career={career} navigate={navigate} />}
      <MobileNavigation
        screen={screen}
        open={menuOpen}
        setOpen={setMenuOpen}
        navigate={navigate}
      />
    </div>
  );
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
        {mainDestinations.map(([id, label, Icon]) => (
          <Button
            key={id}
            variant={screen === id ? 'outline' : 'ghost'}
            className="min-h-10 justify-start text-[.6rem]"
            aria-current={screen === id ? 'page' : undefined}
            onClick={() => navigate(id)}
          >
            <Icon data-icon="inline-start" weight="fill" />
            {label}
          </Button>
        ))}
        <p
          id="mais-areas-desktop"
          className="mt-4 px-3 font-pixel text-[.5rem] text-chalk/70"
        >
          Mais áreas
        </p>
        <ul
          aria-labelledby="mais-areas-desktop"
          className="flex flex-col gap-1"
        >
          {moreDestinations.map(([id, label, Icon]) => (
            <li key={id}>
              <Button
                variant={screen === id ? 'outline' : 'ghost'}
                className="min-h-9 w-full justify-start text-[.55rem] text-chalk/80"
                aria-current={screen === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon data-icon="inline-start" weight="fill" />
                {label}
              </Button>
            </li>
          ))}
        </ul>
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
  open,
  setOpen,
  navigate,
}: {
  screen: Screen;
  open: boolean;
  setOpen(value: boolean): void;
  navigate(value: Screen): void;
}) {
  return (
    <>
      {open && (
        <div className="panel px-rise fixed inset-x-3 bottom-24 z-40 p-3 lg:hidden">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="font-pixel text-[.6rem]">Todas as áreas</p>
            <Badge variant="secondary">{destinations.length} destinos</Badge>
          </div>
          <nav
            aria-label="Mais áreas"
            className="grid max-h-[60dvh] grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3"
          >
            {destinations.map(([id, label, Icon]) => (
              <Button
                key={id}
                variant={screen === id ? 'outline' : 'ghost'}
                className="min-h-11 justify-start text-[.55rem]"
                aria-current={screen === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon data-icon="inline-start" />
                {label}
              </Button>
            ))}
          </nav>
        </div>
      )}
      <nav
        aria-label="Navegação principal mobile"
        className="panel-wood fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 gap-1 px-1.5 py-1.5 lg:hidden"
      >
        {primaryMobile.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={screen === id ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 px-1 font-pixel text-[.5rem]',
              screen === id ? 'bg-board text-bulb' : 'text-chalk',
            )}
            onClick={() => navigate(id)}
          >
            <Icon
              className="size-6 drop-shadow-[0_2px_0_rgb(0_0_0/0.45)]"
              weight="fill"
            />
            {label}
          </button>
        ))}
        <button
          aria-expanded={open}
          className={cn(
            'flex min-h-14 flex-col items-center justify-center gap-1 px-1 font-pixel text-[.45rem]',
            open ? 'bg-board text-bulb' : 'text-chalk',
          )}
          onClick={() => setOpen(!open)}
        >
          <DotsThree
            className="size-6 drop-shadow-[0_2px_0_rgb(0_0_0/0.45)]"
            weight="fill"
          />
          Menu
        </button>
      </nav>
    </>
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
