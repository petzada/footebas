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
import { ClubEmblem } from '@/components/club-emblem';
import { CoachAvatar } from '@/components/coach-avatar';
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
        <header className="glass mb-5 flex min-h-14 items-center justify-between gap-3 rounded-2xl px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <ClubEmblem name={career.club} size={44} decorative />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-[.18em] text-primary">
                {career.club} · Rodada {career.round}
              </p>
              <h1 className="font-display text-3xl font-bold uppercase leading-none sm:text-4xl">
                {labels[screen]}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
        {children}
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
      className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-glass-line bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg"
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
    <aside className="sticky top-0 hidden h-dvh border-r border-glass-line bg-card/60 p-4 lg:flex lg:flex-col">
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
            variant={screen === id ? 'secondary' : 'ghost'}
            className="min-h-10 justify-start font-semibold"
            aria-current={screen === id ? 'page' : undefined}
            onClick={() => navigate(id)}
          >
            <Icon
              data-icon="inline-start"
              weight={screen === id ? 'fill' : 'regular'}
            />
            {label}
          </Button>
        ))}
        <p
          id="mais-areas-desktop"
          className="mt-4 px-3 text-[.65rem] font-bold uppercase tracking-[.18em] text-muted-foreground"
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
                variant={screen === id ? 'secondary' : 'ghost'}
                className="min-h-9 w-full justify-start text-muted-foreground"
                aria-current={screen === id ? 'page' : undefined}
                onClick={() => navigate(id)}
              >
                <Icon
                  data-icon="inline-start"
                  weight={screen === id ? 'fill' : 'regular'}
                />
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
          <p className="text-xs text-muted-foreground">
            Treinador
            {career.coachProfile &&
              ` · ${personalityLabel(career.coachProfile.personality)}`}
          </p>
          <p className="truncate text-base font-extrabold">{career.coach}</p>
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
    <aside className="sticky top-0 hidden h-dvh border-l border-glass-line bg-card/45 p-5 xl:flex xl:flex-col xl:gap-5">
      <section aria-labelledby="proximo-jogo">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
          Próximo jogo
        </p>
        <h2
          id="proximo-jogo"
          className="mt-1 font-display text-2xl font-bold uppercase"
        >
          {career.club} × {career.opponent.club}
        </h2>
        <p className="text-sm text-muted-foreground">
          {career.opponent.report}
        </p>
      </section>
      <Separator />
      <section aria-labelledby="central-rapida" className="flex flex-col gap-2">
        <h2
          id="central-rapida"
          className="font-display text-lg font-bold uppercase"
        >
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
          <span className="font-display font-bold">{money}</span>
        </Button>
      </section>
      <div className="surface mt-auto rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">
          Ritmo da carreira
        </p>
        <p className="mt-1 font-display text-3xl font-bold tabular-nums">
          {career.round}
        </p>
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
        <div className="fixed inset-x-3 bottom-24 z-40 rounded-2xl border border-glass-line bg-popover p-3 text-popover-foreground shadow-2xl lg:hidden">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="font-display text-lg font-bold uppercase">
              Todas as áreas
            </p>
            <Badge variant="secondary">{destinations.length} destinos</Badge>
          </div>
          <nav
            aria-label="Mais áreas"
            className="grid max-h-[60dvh] grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3"
          >
            {destinations.map(([id, label, Icon]) => (
              <Button
                key={id}
                variant={screen === id ? 'secondary' : 'ghost'}
                className="min-h-11 justify-start"
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
        className="glass-strong fixed inset-x-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-2xl px-1.5 py-1.5 lg:hidden"
      >
        {primaryMobile.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={screen === id ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[.66rem] font-bold uppercase tracking-wide',
              screen === id
                ? 'bg-popover text-primary shadow-sm'
                : 'text-muted-foreground',
            )}
            onClick={() => navigate(id)}
          >
            <Icon
              className="size-5"
              weight={screen === id ? 'fill' : 'regular'}
            />
            {label}
          </button>
        ))}
        <button
          aria-expanded={open}
          className={cn(
            'flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[.66rem] font-bold uppercase tracking-wide',
            open
              ? 'bg-popover text-primary shadow-sm'
              : 'text-muted-foreground',
          )}
          onClick={() => setOpen(!open)}
        >
          <DotsThree className="size-5" weight="bold" />
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

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="btn-grass grid size-9 place-items-center rounded-xl">
        <SoccerBall weight="fill" />
      </span>
      <span className="font-display text-2xl font-bold uppercase tracking-tight">
        Footebas
      </span>
    </div>
  );
}
