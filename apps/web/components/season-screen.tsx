'use client';

import { useEffect, useState } from 'react';
import { ChartLineUp, Info, Medal } from '@phosphor-icons/react';
import { ScreenSkeleton } from '@/components/retro/skeleton';
import { ClubEmblem } from '@/components/club-emblem';
import { PixelStar, PixelTrophy } from '@/components/retro/sprites';
import { Badge } from '@/components/ui/badge';
import {
  AWARD_LABEL,
  type SeasonClubRecord,
  type SeasonLeader,
  type SeasonPort,
  type SeasonPositions,
  type SeasonView,
} from '@/lib/season-product';
import { cn } from '@/lib/utils';

const rating = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Temporada (docs/09): read-only season statistics in scoreboard and
 * teletext dress. Everything comes from the season read model; a partial
 * `coverage` is announced instead of filled in.
 */
export function SeasonScreen({
  port,
  clubName,
}: {
  port: SeasonPort;
  /** Managed club, to highlight its rows. */
  clubName: string;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; view: SeasonView }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

  useEffect(() => {
    let active = true;
    port
      .load()
      .then((view) => active && setState({ status: 'ready', view }))
      .catch(
        (caught: unknown) =>
          active &&
          setState({
            status: 'error',
            message:
              caught instanceof Error
                ? caught.message
                : 'Não foi possível carregar a temporada.',
          }),
      );
    return () => {
      active = false;
    };
  }, [port]);

  if (state.status === 'loading')
    return <ScreenSkeleton label="Somando os números da temporada…" />;
  if (state.status === 'error')
    return (
      <p className="panel p-3 text-sm" role="alert">
        {state.message}
      </p>
    );

  const { view } = state;
  return (
    <div className="grid gap-4">
      {view.coverage === 'partial' && (
        <p
          role="status"
          className="panel flex items-start gap-2 border-l-8 border-accent p-3 text-sm"
        >
          <Info className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong>Dados parciais:</strong> esta carreira começou a registrar
            estatísticas no meio da temporada. Os números abaixo contam só os
            jogos gravados desde então.
          </span>
        </p>
      )}
      <Scoreboard view={view} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PositionChart
          positions={view.positions}
          clubName={view.club?.club.name ?? clubName}
        />
        <Honours view={view} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <LeaderTable
          id="temporada-artilharia"
          title="Artilharia"
          unit="Gols"
          leaders={view.topScorers}
          clubName={clubName}
        />
        <LeaderTable
          id="temporada-assistencias"
          title="Assistências"
          unit="Assist."
          leaders={view.topAssists}
          clubName={clubName}
        />
        <LeaderTable
          id="temporada-notas"
          title="Melhores notas"
          unit="Nota"
          leaders={view.topRatings}
          clubName={clubName}
          decimal
          footnote={`Mínimo de ${String(view.minimumRatedAppearances)} jogos.`}
        />
      </div>
      <History view={view} />
    </div>
  );
}

function Scoreboard({ view }: { view: SeasonView }) {
  const record = view.club;
  return (
    <section
      aria-labelledby="temporada-placar"
      className="panel-board grid gap-4 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="temporada-placar" className="led text-sm sm:text-base">
          Temporada {view.season} · {view.year}
        </h2>
        <Badge variant={view.coverage === 'complete' ? 'bulb' : 'secondary'}>
          {view.coverage === 'complete' ? 'Registro completo' : 'Parcial'}
        </Badge>
      </div>
      {record ? (
        <>
          <div className="flex items-center gap-3">
            <ClubEmblem name={record.club.name} size={48} decorative />
            <p className="font-pixel text-[.6rem] text-chalk sm:text-xs">
              {record.club.name}
            </p>
          </div>
          <dl className="grid grid-cols-4 gap-2 text-center sm:grid-cols-7">
            <Digit label="Jogos" value={record.played} />
            <Digit label="V" value={record.won} tone="win" />
            <Digit label="E" value={record.drawn} />
            <Digit label="D" value={record.lost} tone="loss" />
            <Digit label="GP" value={record.goalsFor} />
            <Digit label="GC" value={record.goalsAgainst} />
            <Digit
              label="Saldo"
              value={record.goalDifference}
              signed
              tone={record.goalDifference >= 0 ? 'win' : 'loss'}
            />
          </dl>
          <ResultBar record={record} />
        </>
      ) : (
        <p className="text-sm text-chalk/70">
          Sem clube nesta temporada: os números do elenco aparecem quando você
          assumir um.
        </p>
      )}
    </section>
  );
}

function Digit({
  label,
  value,
  tone,
  signed = false,
}: {
  label: string;
  value: number;
  tone?: 'win' | 'loss';
  signed?: boolean;
}) {
  return (
    <div>
      <dt className="font-pixel text-[.45rem] text-chalk/70">{label}</dt>
      <dd
        className={cn(
          'led text-lg sm:text-2xl',
          tone === 'win' && 'text-primary-foreground',
          tone === 'loss' && 'text-accent',
        )}
      >
        {signed && value > 0 ? '+' : ''}
        {value}
      </dd>
    </div>
  );
}

/** V/E/D as a stacked pixel bar. */
function ResultBar({ record }: { record: SeasonClubRecord }) {
  const total = Math.max(1, record.played);
  const parts = [
    ['Vitórias', record.won, 'bg-primary'],
    ['Empates', record.drawn, 'bg-chalk'],
    ['Derrotas', record.lost, 'bg-accent'],
  ] as const;
  return (
    <div
      role="img"
      aria-label={`${String(record.won)} vitórias, ${String(record.drawn)} empates e ${String(record.lost)} derrotas em ${String(record.played)} jogos`}
      className="flex h-3 w-full gap-px border-2 border-ink bg-ink/60"
    >
      {parts.map(([name, count, color]) => (
        <span
          key={name}
          className={cn('block h-full', color)}
          style={{ width: `${String((count / total) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Position after each round as a pixel line on a chalk-green pitch. */
export function PositionChart({
  positions,
  clubName,
}: {
  positions: readonly SeasonPositions[];
  clubName: string;
}) {
  const [index, setIndex] = useState(0);
  const series = positions[Math.min(index, positions.length - 1)];
  const rounds = series?.rounds ?? [];
  const worst = Math.max(4, ...rounds.map((item) => item.position));
  const width = 320;
  const height = 160;
  const padX = 22;
  const padY = 12;
  const stepX =
    rounds.length > 1 ? (width - padX * 2) / (rounds.length - 1) : 0;
  const stepY = (height - padY * 2) / Math.max(1, worst - 1);
  const x = (i: number) => padX + i * stepX;
  const y = (position: number) => padY + (position - 1) * stepY;
  const path = rounds
    .map((item, i) => {
      const px = x(i);
      const py = y(item.position);
      if (i === 0) return `M${String(px)} ${String(py)}`;
      const prev = rounds[i - 1]!;
      // Stepped line: hold the previous height, then jump (teletext style).
      return `H${String(px)} V${String(y(prev.position))} V${String(py)}`;
    })
    .join(' ');
  const summary = rounds
    .map((item) => `rodada ${String(item.round)}: ${String(item.position)}º`)
    .join(', ');

  return (
    <section
      aria-labelledby="temporada-posicao"
      className="panel flex flex-col gap-3 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="temporada-posicao"
          className="flex items-center gap-2 font-pixel text-[.65rem]"
        >
          <ChartLineUp aria-hidden="true" />
          Posição por rodada
        </h2>
        {positions.length > 1 && (
          <label className="flex items-center gap-2 text-xs">
            <span className="sr-only">Competição</span>
            <select
              aria-label="Competição"
              className="border-2 border-ink bg-popover px-2 py-1 font-pixel text-[.5rem]"
              value={index}
              onChange={(event) => setIndex(Number(event.target.value))}
            >
              {positions.map((item, i) => (
                <option key={item.competitionId} value={i}>
                  {item.competition}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          O gráfico aparece depois da primeira rodada de liga.
        </p>
      ) : (
        <>
          <p className="font-pixel text-[.5rem] text-muted-foreground">
            {series?.competition} · {clubName}
          </p>
          <svg
            role="img"
            aria-label={`Posição do ${clubName} por rodada em ${series?.competition ?? 'liga'}: ${summary}`}
            viewBox={`0 0 ${String(width)} ${String(height)}`}
            className="panel-chalk w-full"
            shapeRendering="crispEdges"
          >
            {Array.from({ length: worst }, (_, i) => i + 1).map((position) => (
              <g key={position}>
                <line
                  x1={padX}
                  x2={width - padX}
                  y1={y(position)}
                  y2={y(position)}
                  stroke="currentColor"
                  strokeOpacity={position === 1 ? 0.7 : 0.18}
                  strokeDasharray={position === 1 ? undefined : '2 4'}
                />
                {(position === 1 ||
                  position === worst ||
                  position % Math.ceil(worst / 5) === 0) && (
                  <text
                    x={4}
                    y={y(position) + 3}
                    fontSize={7}
                    fill="currentColor"
                    fontFamily="var(--font-pixel)"
                  >
                    {position}º
                  </text>
                )}
              </g>
            ))}
            <path
              d={path}
              fill="none"
              stroke="var(--bulb)"
              strokeWidth={3}
              strokeLinejoin="miter"
            />
            {rounds.map((item, i) => (
              <rect
                key={item.round}
                x={x(i) - 3}
                y={y(item.position) - 3}
                width={6}
                height={6}
                fill="var(--bulb)"
                stroke="var(--ink)"
              />
            ))}
            {rounds.map(
              (item, i) =>
                (i === 0 ||
                  i === rounds.length - 1 ||
                  i % Math.ceil(rounds.length / 6) === 0) && (
                  <text
                    key={`r-${String(item.round)}`}
                    x={x(i)}
                    y={height - 2}
                    fontSize={6}
                    textAnchor="middle"
                    fill="currentColor"
                    fontFamily="var(--font-pixel)"
                  >
                    R{item.round}
                  </text>
                ),
            )}
          </svg>
          <p className="led text-right text-xs">
            Agora: {rounds[rounds.length - 1]?.position}º
          </p>
        </>
      )}
    </section>
  );
}

function Honours({ view }: { view: SeasonView }) {
  return (
    <section
      aria-labelledby="temporada-honras"
      className="panel flex flex-col gap-4 p-4"
    >
      <h2
        id="temporada-honras"
        className="flex items-center gap-2 font-pixel text-[.65rem]"
      >
        <PixelTrophy size={16} />
        Campeões e premiações
      </h2>
      <div>
        <h3 className="font-pixel text-[.5rem] text-muted-foreground">
          Campeões
        </h3>
        {view.champions.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhum título decidido ainda nesta temporada.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {view.champions.map((champion) => (
              <li
                key={champion.competitionId}
                className="flex items-center gap-3 border-2 border-ink bg-popover p-2"
              >
                <ClubEmblem name={champion.club.name} size={28} decorative />
                <span className="min-w-0 text-sm">
                  <strong className="block truncate">
                    {champion.club.name}
                  </strong>
                  <small className="text-muted-foreground">
                    {champion.competition}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-pixel text-[.5rem] text-muted-foreground">
          Premiações
        </h3>
        {view.awards.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Os prêmios individuais aparecem com os primeiros jogos.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {view.awards.map((award) => (
              <li
                key={award.kind}
                className="sticker flex items-center gap-2 p-2 text-sm"
              >
                {award.kind === 'best_rating' ? (
                  <PixelStar size={18} />
                ) : (
                  <Medal className="size-5 text-accent" aria-hidden="true" />
                )}
                <span className="min-w-0">
                  <small className="block font-pixel text-[.45rem] text-muted-foreground">
                    {AWARD_LABEL[award.kind]}
                  </small>
                  <strong className="block truncate">{award.playerName}</strong>
                  <small className="text-muted-foreground">
                    {award.kind === 'best_rating'
                      ? `nota ${rating.format(award.value)}`
                      : `${String(award.value)} ${award.kind === 'top_scorer' ? 'gols' : 'assistências'}`}
                    {award.club ? ` · ${award.club.name}` : ''}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LeaderTable({
  id,
  title,
  unit,
  leaders,
  clubName,
  decimal = false,
  footnote,
}: {
  id: string;
  title: string;
  unit: string;
  leaders: readonly SeasonLeader[];
  clubName: string;
  decimal?: boolean;
  footnote?: string;
}) {
  return (
    <section aria-labelledby={id} className="panel-board p-3">
      <h2 id={id} className="led px-1 text-[.65rem]">
        {title}
      </h2>
      {leaders.length === 0 ? (
        <p className="mt-2 px-1 text-sm text-chalk/70">Sem registros ainda.</p>
      ) : (
        <table className="teletext mt-2 w-full text-chalk">
          <caption className="sr-only">{title} da temporada</caption>
          <thead>
            <tr className="text-left text-bulb">
              <th scope="col" className="w-6 pb-1">
                #
              </th>
              <th scope="col" className="pb-1">
                Atleta
              </th>
              <th scope="col" className="pb-1 text-right">
                J
              </th>
              <th scope="col" className="pb-1 pr-1 text-right">
                {unit}
              </th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((item, index) => {
              const mine = item.club?.name === clubName;
              return (
                <tr
                  key={item.playerId}
                  className={cn(
                    'border-t border-chalk/20',
                    mine && 'text-bulb',
                  )}
                >
                  <td className="py-1 pl-1">{index + 1}</td>
                  <td className="py-1">
                    <span className="block truncate">{item.playerName}</span>
                    {item.club && (
                      <span className="block truncate text-[.45rem] text-chalk/60">
                        {item.club.name}
                      </span>
                    )}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {item.appearances}
                  </td>
                  <td className="py-1 pr-1 text-right tabular-nums">
                    {decimal ? rating.format(item.value) : item.value}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {footnote && (
        <p className="mt-2 px-1 font-pixel text-[.45rem] text-chalk/60">
          {footnote}
        </p>
      )}
    </section>
  );
}

function History({ view }: { view: SeasonView }) {
  return (
    <section
      aria-labelledby="temporada-historico"
      className="panel flex flex-col gap-3 p-4"
    >
      <h2 id="temporada-historico" className="font-pixel text-[.65rem]">
        Histórico de temporadas
      </h2>
      {view.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Esta é a primeira temporada registrada. O histórico cresce a cada
          fechamento.
        </p>
      ) : (
        <table className="teletext w-full">
          <caption className="sr-only">Temporadas anteriores</caption>
          <thead>
            <tr className="bg-board text-left text-bulb">
              <th scope="col" className="pb-1 pl-1">
                Temp.
              </th>
              <th scope="col" className="pb-1">
                Clube
              </th>
              <th scope="col" className="pb-1 text-right">
                V-E-D
              </th>
              <th scope="col" className="pb-1">
                Títulos
              </th>
              <th scope="col" className="pb-1 pr-1">
                Artilheiro
              </th>
            </tr>
          </thead>
          <tbody>
            {view.history.map((entry) => (
              <tr key={entry.season} className="border-t-2">
                <td className="py-1.5 pl-1">
                  {entry.season} · {entry.year}
                </td>
                <td className="py-1.5">{entry.club?.club.name ?? '—'}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {entry.club
                    ? `${String(entry.club.won)}-${String(entry.club.drawn)}-${String(entry.club.lost)}`
                    : '—'}
                </td>
                <td className="py-1.5">
                  {entry.champions.length === 0
                    ? '—'
                    : entry.champions
                        .map(
                          (item) => `${item.competition} (${item.club.name})`,
                        )
                        .join(', ')}
                </td>
                <td className="py-1.5 pr-1">
                  {entry.topScorers[0]
                    ? `${entry.topScorers[0].playerName} (${String(entry.topScorers[0].value)})`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
