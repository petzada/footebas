'use client';

import { useEffect, useState, type FocusEvent } from 'react';
import {
  CalendarStar,
  Ranking as RankingIcon,
  Rocket,
  Trophy,
} from '@phosphor-icons/react';
import { CoachAvatar } from '@/components/coach-avatar';
import { PixelTrophy } from '@/components/retro/sprites';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COACH_AVATARS, type CoachAvatarId } from '@/lib/coach-profile';
import {
  currentPeriod,
  formatCount,
  periodLabel,
  RANKING_SCOPES,
  recentPeriods,
  SCOPE_LABEL,
  type MyRankingEntry,
  type RankingPort,
  type RankingRow,
  type RankingScope,
  type RankingView,
} from '@/lib/ranking-product';
import { cn } from '@/lib/utils';

const RULES: Record<RankingScope, string> = {
  general:
    'Soma os pontos de conquistas validadas pelo servidor: títulos (continental 180, Série A 100, B 60, C 40, copa nacional 70, estadual 25), acessos (45) e temporada completa no cargo (5). O título vale assim que o campeonato termina. Só a sua melhor carreira conta.',
  titles:
    'Conta os títulos (liga, copa, estadual e continental) da sua melhor carreira. Empate: mais pontos, depois quem chegou primeiro.',
  best_season:
    'A maior soma de pontos numa única temporada da sua melhor carreira. Empate: a temporada mais antiga.',
  rise: 'Mede façanhas de clube pequeno: só títulos e acessos de clubes com reputação até 65, multiplicados por até 3× quanto menor a reputação. Temporada completa não conta.',
  monthly:
    'Soma os pontos validados no mês civil em que o servidor registrou a conquista. Fecha no dia 1 do mês seguinte.',
};

const ICON: Record<RankingScope, typeof RankingIcon> = {
  general: RankingIcon,
  titles: Trophy,
  best_season: CalendarStar,
  rise: Rocket,
  monthly: RankingIcon,
};

/** Header of the value column of each scope. */
const MEASURE: Record<RankingScope, string> = {
  general: 'Pontos',
  titles: 'Títulos',
  best_season: 'Pontos',
  rise: 'Pontos',
  monthly: 'Pontos',
};

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; view: RankingView }
  | { status: 'error'; message: string };

/** Keeps a tab that got focus (keyboard or touch) fully inside the strip. */
function revealTab(event: FocusEvent<HTMLButtonElement>) {
  // jsdom and old browsers have no scrollIntoView options.
  event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/**
 * Ranking de treinadores (docs/09 decision 10, ADR 0013, ADR 0017): five
 * scopes in a horizontal strip of tabs that scrolls and snaps (decision D8:
 * on a phone the next tab stays half visible), live boards and the player's
 * own position out of every participant.
 */
export function RankingScreen({
  port,
  now = () => new Date(),
}: {
  port: RankingPort;
  now?: () => Date;
}) {
  const [scope, setScope] = useState<RankingScope>('general');
  const [period, setPeriod] = useState(() => currentPeriod(now()));
  const [boards, setBoards] = useState<Record<string, Loaded>>({});
  const [mine, setMine] = useState<readonly MyRankingEntry[] | null>(null);

  const key = scope === 'monthly' ? `monthly:${period}` : scope;
  const board: Loaded = boards[key] ?? { status: 'loading' };

  useEffect(() => {
    let active = true;
    port
      .mine()
      .then((entries) => active && setMine(entries))
      .catch(() => active && setMine(null));
    return () => {
      active = false;
    };
  }, [port]);

  useEffect(() => {
    if (boards[key]) return;
    let active = true;
    port
      .leaderboard(scope, scope === 'monthly' ? period : undefined)
      .then(
        (view) =>
          active &&
          setBoards((current) => ({
            ...current,
            [key]: { status: 'ready', view },
          })),
      )
      .catch(
        (caught: unknown) =>
          active &&
          setBoards((current) => ({
            ...current,
            [key]: {
              status: 'error',
              message:
                caught instanceof Error
                  ? caught.message
                  : 'Não foi possível carregar o ranking.',
            },
          })),
      );
    return () => {
      active = false;
    };
    // `boards` is only read to skip refetches; it must not retrigger them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, scope, period, key]);

  // The monthly position of /me is the current month's only.
  const myEntry = mine?.find(
    (entry) =>
      entry.scope === scope && (scope !== 'monthly' || entry.period === period),
  );

  return (
    <div className="grid min-w-0 gap-4">
      <section
        aria-labelledby="ranking-titulo"
        className="panel-board flex flex-wrap items-center justify-between gap-3 p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <PixelTrophy size={28} />
          <div className="min-w-0">
            <h2 id="ranking-titulo" className="led text-sm sm:text-base">
              Ranking de treinadores
            </h2>
            <p className="text-xs text-chalk/70">
              Só conquistas validadas pelo servidor. Sem prêmio em dinheiro:
              aqui vale o reconhecimento.
            </p>
          </div>
        </div>
        <MyPosition entry={myEntry} scope={scope} signedIn={mine !== null} />
      </section>

      <Tabs
        value={scope}
        onValueChange={(value) => setScope(value as RankingScope)}
        className="min-w-0"
      >
        {/*
          Five scopes do not fit 320–430 px: the strip scrolls sideways and
          snaps to a tab; each tab takes 40% of the strip on a phone, so the
          third one shows by half and invites the swipe.
        */}
        <TabsList
          aria-label="Escopo do ranking"
          data-scroll-snap="x"
          className="panel-wood flex w-full snap-x snap-mandatory scroll-px-1 items-stretch justify-start gap-1 overflow-x-auto overscroll-x-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {RANKING_SCOPES.map((item) => (
            <TabsTrigger
              key={item}
              value={item}
              onFocus={revealTab}
              className="min-h-11 min-w-0 flex-none basis-[40%] snap-start whitespace-normal bg-ink/35 px-2 text-center leading-tight text-chalk data-[state=active]:shadow-[inset_0_-3px_0_0_var(--bulb)] sm:basis-auto sm:px-3"
            >
              {SCOPE_LABEL[item]}
            </TabsTrigger>
          ))}
        </TabsList>
        {scope === 'monthly' && (
          <label className="mt-2 flex items-center justify-end gap-2 text-xs">
            <span className="font-pixel text-[.5rem]">Mês</span>
            <select
              aria-label="Mês do ranking"
              className="min-h-11 border-2 border-ink bg-popover px-2 font-pixel text-[.5rem]"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              {recentPeriods(6, now()).map((item) => (
                <option key={item} value={item}>
                  {periodLabel(item)}
                </option>
              ))}
            </select>
          </label>
        )}
        {RANKING_SCOPES.map((item) => {
          const Icon = ICON[item];
          return (
            <TabsContent key={item} value={item}>
              <Board state={board} scope={item} myEntry={myEntry} />
              <p className="panel mt-3 flex items-start gap-2 p-3 text-xs text-muted-foreground">
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <strong>Como pontua:</strong> {RULES[item]} O quadro é ao vivo
                  (atualiza em até 30 segundos). Toda conta entra com 0; a lista
                  mostra quem já criou carreira.
                </span>
              </p>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

const AVATAR_SIZE = 24;

/** Same pixel coach for the same name when a row has no usable avatar. */
function fallbackAvatar(name: string): CoachAvatarId {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COACH_AVATARS[hash % COACH_AVATARS.length] ?? 'avatar-01';
}

/**
 * Coach avatar beside the name. Decorative (`alt=""`): the name is right
 * next to it. A picture URL that fails to load, an unknown id or a missing
 * avatar falls back to a pixel coach derived from the name.
 */
export function RankingAvatar({
  avatar,
  name,
}: {
  avatar: string | undefined;
  name: string;
}) {
  // The URL that failed, so a row that gets a new avatar tries it again.
  const [brokenSrc, setBrokenSrc] = useState<string>();
  // Only https pictures (our CDN or Google, validated by the API).
  if (avatar?.startsWith('https://') && avatar !== brokenSrc)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- coach picture from our CDN or Google
      <img
        src={avatar}
        alt=""
        data-avatar="custom"
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBrokenSrc(avatar)}
        className="px-border inline-block shrink-0 bg-chalk object-cover"
        // A photo shrunk to a few pixels reads better smoothed than with
        // nearest-neighbour; the pixel avatars are crisp SVG already.
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          imageRendering: 'auto',
        }}
      />
    );
  const id =
    avatar !== undefined &&
    (COACH_AVATARS as readonly string[]).includes(avatar)
      ? (avatar as CoachAvatarId)
      : fallbackAvatar(name);
  return (
    <span
      aria-hidden="true"
      data-avatar-fallback={id === avatar ? undefined : 'true'}
      className="inline-flex shrink-0"
    >
      <CoachAvatar avatar={id} size={AVATAR_SIZE} />
    </span>
  );
}

/** Value shown for the scope: titles, or points. */
function measureOf(
  scope: RankingScope,
  row: Pick<RankingRow, 'points' | 'titles'>,
) {
  return scope === 'titles' ? (row.titles ?? 0) : row.points;
}

function measureUnit(scope: RankingScope, value: number) {
  if (scope === 'titles') return value === 1 ? 'título' : 'títulos';
  return 'pts';
}

/** "Sua posição": Nº de M participants, with the scope's measure. */
function MyPosition({
  entry,
  scope,
  signedIn,
}: {
  entry: MyRankingEntry | undefined;
  scope: RankingScope;
  signedIn: boolean;
}) {
  if (!signedIn) return null;
  const value =
    entry === undefined
      ? 0
      : measureOf(scope, {
          points: entry.points ?? 0,
          titles: entry.titles ?? 0,
        });
  return (
    <div
      aria-label="Sua posição"
      role="group"
      className="border-2 border-chalk/40 bg-ink/40 px-3 py-2 text-right"
    >
      <p className="font-pixel text-[.45rem] text-chalk/70">Sua posição</p>
      {entry?.position ? (
        <>
          <p className="led text-lg">
            {formatCount(entry.position)}º
            {entry.total ? (
              <span className="ml-1 text-[.5rem] text-chalk/80">
                de {formatCount(entry.total)}
              </span>
            ) : null}
          </p>
          <p className="font-pixel text-[.45rem] text-chalk/80">
            {formatCount(value)} {measureUnit(scope, value)}
            {scope === 'best_season' && entry.season
              ? ` · temporada ${String(entry.season)}`
              : ''}
          </p>
        </>
      ) : (
        <p className="text-xs text-chalk/80">
          Crie uma carreira para entrar no quadro
        </p>
      )}
    </div>
  );
}

function Board({
  state,
  scope,
  myEntry,
}: {
  state: Loaded;
  scope: RankingScope;
  myEntry: MyRankingEntry | undefined;
}) {
  if (state.status === 'loading')
    return (
      <p className="panel p-3 text-sm" role="status">
        Acendendo o placar…
      </p>
    );
  if (state.status === 'error')
    return (
      <p className="panel p-3 text-sm" role="alert">
        {state.message}
      </p>
    );
  const { view } = state;
  const label = SCOPE_LABEL[scope];
  if (view.rows.length === 0)
    return (
      <section
        aria-label={`Ranking ${label} vazio`}
        className="panel-chalk flex flex-col items-center gap-3 p-6 text-center"
      >
        <PixelTrophy size={40} />
        <h3 className="font-pixel text-[.65rem]">O pódio está vazio</h3>
        <p className="max-w-sm text-sm text-chalk/90">
          {scope === 'monthly'
            ? `Ninguém entrou no quadro de ${periodLabel(view.period).toLowerCase()} ainda. O primeiro título ou acesso do mês acende seu nome aqui.`
            : 'Ainda não há treinadores no quadro. Crie sua carreira: você entra com 0 e o primeiro título já muda a lista.'}
        </p>
      </section>
    );
  const isMine = (row: RankingRow) =>
    myEntry?.position !== undefined &&
    row.position === myEntry.position &&
    (myEntry.displayName === undefined ||
      myEntry.displayName === row.displayName);
  const inRows = view.rows.some(isMine);
  const myValue =
    myEntry === undefined
      ? 0
      : measureOf(scope, {
          points: myEntry.points ?? 0,
          titles: myEntry.titles ?? 0,
        });
  return (
    <section aria-label={`Ranking ${label}`} className="panel-board p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="font-pixel text-[.5rem] text-chalk/70">
          {periodLabel(view.period)} · {formatCount(view.total)}{' '}
          {view.total === 1 ? 'participante' : 'participantes'}
        </p>
        {view.generatedAt && (
          <Badge variant="board" className="normal-case">
            Ao vivo ·{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(view.generatedAt))}
          </Badge>
        )}
      </div>
      <table className="teletext mt-2 w-full text-chalk">
        <caption className="sr-only">
          Ranking {label} · {periodLabel(view.period)}
        </caption>
        <thead>
          <tr className="text-left text-bulb">
            <th scope="col" className="w-10 pb-1 pl-1">
              #
            </th>
            <th scope="col" className="pb-1">
              Treinador
            </th>
            <th scope="col" className="pb-1 pr-1 text-right">
              {MEASURE[scope]}
            </th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => {
            const mine = isMine(row);
            return (
              <tr
                key={`${String(row.position)}-${row.displayName}`}
                className={cn(
                  'border-t border-chalk/20',
                  mine && 'bg-bulb text-bulb-foreground',
                )}
                {...(mine ? { 'aria-current': 'true' as const } : {})}
              >
                <td className="py-1.5 pl-1 tabular-nums">
                  {row.position <= 3 ? (
                    <span aria-hidden="true">
                      {['🥇', '🥈', '🥉'][row.position - 1]}
                    </span>
                  ) : null}
                  <span className={cn(row.position <= 3 && 'sr-only')}>
                    {formatCount(row.position)}
                  </span>
                </td>
                {/* max-w-0: the name truncates instead of widening the table. */}
                <td className="w-full max-w-0 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <RankingAvatar avatar={row.avatar} name={row.displayName} />
                    <span className="min-w-0">
                      <span className="block truncate">{row.displayName}</span>
                      {scope === 'best_season' && row.season ? (
                        <span className="block text-[.7rem] opacity-80">
                          Temporada {row.season}
                        </span>
                      ) : null}
                    </span>
                    {mine && <span className="sr-only"> (você)</span>}
                  </span>
                </td>
                <td className="py-1.5 pr-1 text-right tabular-nums">
                  {formatCount(measureOf(scope, row))}
                  {scope === 'titles' ? (
                    <span className="block text-[.7rem] opacity-80">
                      {formatCount(row.points)} pts
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {myEntry?.position !== undefined && !inRows && (
            <tr
              className="border-t-2 border-bulb bg-bulb text-bulb-foreground"
              aria-current="true"
            >
              <td className="py-1.5 pl-1 tabular-nums">
                {formatCount(myEntry.position)}
              </td>
              <td className="w-full max-w-0 py-1.5">
                <span className="flex min-w-0 items-center gap-2">
                  <RankingAvatar
                    avatar={myEntry.avatar}
                    name={myEntry.displayName ?? 'Você'}
                  />
                  <span className="min-w-0 truncate">
                    {myEntry.displayName ?? 'Você'} (você)
                  </span>
                </span>
              </td>
              <td className="py-1.5 pr-1 text-right tabular-nums">
                {formatCount(myValue)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
