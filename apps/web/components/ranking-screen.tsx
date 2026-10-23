'use client';

import { useEffect, useState } from 'react';
import { Ranking as RankingIcon, Rocket } from '@phosphor-icons/react';
import { ScreenSkeleton } from '@/components/retro/skeleton';
import { CoachAvatar } from '@/components/coach-avatar';
import { PixelTrophy } from '@/components/retro/sprites';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { COACH_AVATARS, type CoachAvatarId } from '@/lib/coach-profile';
import {
  currentPeriod,
  periodLabel,
  recentPeriods,
  SCOPE_LABEL,
  type MyRankingEntry,
  type RankingPort,
  type RankingScope,
  type RankingView,
} from '@/lib/ranking-product';
import { cn } from '@/lib/utils';

const SCOPES: readonly RankingScope[] = ['global', 'rise', 'monthly'];

const RULES: Record<RankingScope, string> = {
  global:
    'Soma os pontos de conquistas validadas pelo servidor: títulos (continental 180, Série A 100, B 60, C 40, copa nacional 70, estadual 25), acessos (45) e temporada completa no cargo (5). Só a sua melhor carreira conta.',
  rise: 'Mede façanhas de clube pequeno: só títulos e acessos de clubes com reputação até 65, multiplicados por até 3× quanto menor a reputação. Temporada completa não conta.',
  monthly:
    'Soma os pontos validados no mês civil em que o servidor registrou a conquista. Fecha no dia 1 do mês seguinte.',
};

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; view: RankingView }
  | { status: 'error'; message: string };

/**
 * Ranking global (docs/09 decision 10, ADR 0013): Global / Ascensão / Mensal
 * tabs over cached snapshots, with the player's own position highlighted.
 */
export function RankingScreen({
  port,
  now = () => new Date(),
}: {
  port: RankingPort;
  now?: () => Date;
}) {
  const [scope, setScope] = useState<RankingScope>('global');
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

  const myEntry = mine?.find(
    (entry) =>
      entry.scope === scope && (scope !== 'monthly' || entry.period === period),
  );

  return (
    <div className="grid gap-4">
      <section
        aria-labelledby="ranking-titulo"
        className="panel-board flex flex-wrap items-center justify-between gap-3 p-4"
      >
        <div className="flex items-center gap-3">
          <PixelTrophy size={28} />
          <div>
            <h2 id="ranking-titulo" className="led text-sm sm:text-base">
              Ranking de treinadores
            </h2>
            <p className="text-xs text-chalk/70">
              Só conquistas validadas pelo servidor. Sem prêmio em dinheiro:
              aqui vale o reconhecimento.
            </p>
          </div>
        </div>
        <MyPosition entry={myEntry} signedIn={mine !== null} />
      </section>

      <Tabs
        value={scope}
        onValueChange={(value) => setScope(value as RankingScope)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList aria-label="Escopo do ranking">
            {SCOPES.map((item) => (
              <TabsTrigger key={item} value={item}>
                {SCOPE_LABEL[item]}
              </TabsTrigger>
            ))}
          </TabsList>
          {scope === 'monthly' && (
            <label className="flex items-center gap-2 text-xs">
              <span className="font-pixel text-[.5rem]">Mês</span>
              <select
                aria-label="Mês do ranking"
                className="min-h-10 border-2 border-ink bg-popover px-2 font-pixel text-[.5rem]"
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
        </div>
        {SCOPES.map((item) => (
          <TabsContent key={item} value={item}>
            <Board state={board} scope={item} myEntry={myEntry} />
            <p className="panel mt-3 flex items-start gap-2 p-3 text-xs text-muted-foreground">
              {item === 'rise' ? (
                <Rocket className="mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <RankingIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              <span>
                <strong>Como pontua:</strong> {RULES[item]} O quadro atualiza a
                cada 15 minutos.
              </span>
            </p>
          </TabsContent>
        ))}
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

function MyPosition({
  entry,
  signedIn,
}: {
  entry: MyRankingEntry | undefined;
  signedIn: boolean;
}) {
  if (!signedIn) return null;
  return (
    <div
      aria-label="Minha posição"
      role="group"
      className="border-2 border-chalk/40 bg-ink/40 px-3 py-2 text-right"
    >
      <p className="font-pixel text-[.45rem] text-chalk/70">Minha posição</p>
      {entry?.position ? (
        <p className="led text-lg">
          {entry.position}º
          <span className="ml-2 text-[.5rem] text-chalk/80">
            {entry.points} pts
          </span>
        </p>
      ) : (
        <p className="text-xs text-chalk/80">Ainda sem pontos aqui</p>
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
    return <ScreenSkeleton label="Acendendo o placar…" rows={6} />;
  if (state.status === 'error')
    return (
      <p className="panel p-3 text-sm" role="alert">
        {state.message}
      </p>
    );
  const { view } = state;
  if (view.rows.length === 0)
    return (
      <section
        aria-label={`Ranking ${SCOPE_LABEL[scope]} vazio`}
        className="panel-chalk flex flex-col items-center gap-3 p-6 text-center"
      >
        <PixelTrophy size={40} />
        <h3 className="font-pixel text-[.65rem]">O pódio está vazio</h3>
        <p className="max-w-sm text-sm text-chalk/90">
          {scope === 'monthly'
            ? `Ninguém pontuou em ${periodLabel(view.period).toLowerCase()} ainda. Feche uma temporada com título ou acesso e seu nome acende aqui.`
            : 'Ainda não há conquistas validadas. Seja o primeiro: conquiste um título ou um acesso e volte depois do fechamento da temporada.'}
        </p>
      </section>
    );
  const inRows = view.rows.some(
    (row) =>
      myEntry?.position !== undefined && row.position === myEntry.position,
  );
  return (
    <section
      aria-label={`Ranking ${SCOPE_LABEL[scope]}`}
      className="panel-board p-3"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="font-pixel text-[.5rem] text-chalk/70">
          {periodLabel(view.period)} · {view.total}{' '}
          {view.total === 1 ? 'treinador' : 'treinadores'}
        </p>
        {view.generatedAt && (
          <Badge variant="board" className="normal-case">
            {new Intl.DateTimeFormat('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(view.generatedAt))}
          </Badge>
        )}
      </div>
      <table className="teletext mt-2 w-full text-chalk">
        <caption className="sr-only">
          Ranking {SCOPE_LABEL[scope]} · {periodLabel(view.period)}
        </caption>
        <thead>
          <tr className="text-left text-bulb">
            <th scope="col" className="w-8 pb-1 pl-1">
              #
            </th>
            <th scope="col" className="pb-1">
              Treinador
            </th>
            <th scope="col" className="pb-1 pr-1 text-right">
              Pontos
            </th>
          </tr>
        </thead>
        <tbody>
          {view.rows.map((row) => {
            const mine =
              myEntry?.position !== undefined &&
              row.position === myEntry.position &&
              (myEntry.displayName === undefined ||
                myEntry.displayName === row.displayName);
            return (
              <tr
                key={`${String(row.position)}-${row.displayName}`}
                className={cn(
                  'border-t border-chalk/20',
                  mine && 'bg-bulb text-bulb-foreground',
                )}
                {...(mine ? { 'aria-current': 'true' as const } : {})}
              >
                <td className="py-1.5 pl-1">
                  {row.position <= 3 ? (
                    <span aria-hidden="true">
                      {['🥇', '🥈', '🥉'][row.position - 1]}
                    </span>
                  ) : null}
                  <span className={cn(row.position <= 3 && 'sr-only')}>
                    {row.position}
                  </span>
                </td>
                {/* max-w-0: the name truncates instead of widening the table. */}
                <td className="w-full max-w-0 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <RankingAvatar avatar={row.avatar} name={row.displayName} />
                    <span className="min-w-0 truncate">{row.displayName}</span>
                    {mine && <span className="sr-only"> (você)</span>}
                  </span>
                </td>
                <td className="py-1.5 pr-1 text-right tabular-nums">
                  {row.points}
                </td>
              </tr>
            );
          })}
          {myEntry?.position !== undefined && !inRows && (
            <tr
              className="border-t-2 border-bulb bg-bulb text-bulb-foreground"
              aria-current="true"
            >
              <td className="py-1.5 pl-1">{myEntry.position}</td>
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
                {myEntry.points}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
