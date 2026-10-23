'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy } from '@phosphor-icons/react';
import { ClubEmblem } from '@/components/club-emblem';
import { ScreenSkeleton } from '@/components/retro/skeleton';
import type { CareerView } from '@/lib/career-api';
import type {
  CompetitionProductPort,
  CompetitionTableView,
  CompetitionTablesView,
  TableClubRef,
  TableGroupView,
  TableStageView,
  TableZoneKind,
  TieView,
} from '@/lib/competition-product';
import {
  CATEGORY_LABEL,
  STAGE_STATUS_LABEL,
  ZONE_TONE,
  defaultStageId,
  initialCompetitionId,
  legendOf,
  orderedCompetitions,
  orderedGroups,
  shortClubName,
  tieSummary,
  withCareerLeague,
  zoneOf,
} from '@/lib/competition-tables';
import { formatGameDate } from '@/lib/inbox-product';
import { cn } from '@/lib/utils';

/**
 * Classificação (docs/design revisão mobile, D7): every competition in its
 * own format, read from `GET /v1/careers/:id/tables`. Leagues and estaduais
 * are a teletext table with zone bands; cups a list of ties per round;
 * the Libertadores its preliminary ties, one panel per group and then the
 * knockout; rounds not drawn yet read "a definir". Without the tables
 * (older server) the league of the career read model is shown.
 */
export function CompetitionTables({
  port,
  career,
  initialCompetitionId: requested,
}: {
  port: CompetitionProductPort;
  career: CareerView;
  /** Competition opened first (e.g. from a "Ver tabela" button). */
  initialCompetitionId?: string | undefined;
}) {
  const [view, setView] = useState<CompetitionTablesView | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    port.tables ? 'loading' : 'unavailable',
  );
  useEffect(() => {
    if (!port.tables) return;
    let active = true;
    port
      .tables()
      .then((loaded) => {
        if (!active) return;
        setView(withCareerLeague(loaded, career));
        setStatus('ready');
      })
      .catch(() => active && setStatus('unavailable'));
    return () => {
      active = false;
    };
    // The career only shapes the demo fallback; reloading on every career
    // change would refetch the tables after each command.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port]);

  if (status === 'loading')
    return <ScreenSkeleton label="Abrindo as tabelas…" />;
  if (status === 'unavailable' || !view)
    return <LeagueStandings career={career} />;
  return <TablesBrowser view={view} club={career.club} requested={requested} />;
}

function TablesBrowser({
  view,
  club,
  requested,
}: {
  view: CompetitionTablesView;
  club: string;
  requested: string | undefined;
}) {
  const competitions = orderedCompetitions(view);
  const [competitionId, setCompetitionId] = useState(
    () => initialCompetitionId(view, requested) ?? '',
  );
  const table =
    competitions.find((item) => item.competitionId === competitionId) ??
    competitions[0];
  // One stage choice per competition, so going back and forth keeps it.
  const [stageChoice, setStageChoice] = useState<Record<string, string>>({});
  if (!table)
    return (
      <p className="panel p-4 text-sm text-muted-foreground">
        Nenhuma competição em andamento nesta temporada.
      </p>
    );
  const stageId = stageChoice[table.competitionId] ?? defaultStageId(table);
  const stage =
    table.stages.find((item) => item.id === stageId) ?? table.stages[0];

  return (
    <section aria-labelledby="classificacao-titulo" className="grid gap-3">
      {/* On the grass, not on a panel: chalk tones keep AA contrast. */}
      <header className="text-chalk drop-shadow-[0_1px_0_rgb(0_0_0/0.6)]">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-chalk/90">
          Temporada {view.season}
        </p>
        <h2
          id="classificacao-titulo"
          className="font-display text-xs font-bold uppercase sm:text-sm"
        >
          Classificação
        </h2>
      </header>

      <ScrollTabs
        label="Competição"
        items={competitions.map((item) => ({
          id: item.competitionId,
          label: item.name,
          mark: item.managed ? 'meu clube' : undefined,
        }))}
        value={table.competitionId}
        onChange={setCompetitionId}
      />

      <CompetitionSummary table={table} />

      {table.stages.length > 1 && stage && (
        <ScrollTabs
          label={`Fase · ${table.name}`}
          size="sm"
          items={table.stages.map((item) => ({
            id: item.id,
            label: item.name,
            mark:
              item.status === 'scheduled' &&
              item.ties.length === 0 &&
              item.groups.length === 0
                ? 'a definir'
                : undefined,
          }))}
          value={stage.id}
          onChange={(id) =>
            setStageChoice((current) => ({
              ...current,
              [table.competitionId]: id,
            }))
          }
        />
      )}

      {stage ? (
        <StagePanel
          key={`${table.competitionId}:${stage.id}`}
          stage={stage}
          club={club}
          caption={`${table.name} · ${stage.name}`}
        />
      ) : (
        <p className="panel p-4 text-sm text-muted-foreground">
          As fases desta competição ainda não foram definidas.
        </p>
      )}
    </section>
  );
}

function CompetitionSummary({ table }: { table: CompetitionTableView }) {
  const champion = table.champion;
  return (
    <div className="panel-board flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 font-pixel text-[.5rem] leading-relaxed">
      <span className="text-bulb">{CATEGORY_LABEL[table.category]}</span>
      <span aria-hidden="true">·</span>
      <span>
        {table.status === 'complete'
          ? 'Encerrada'
          : table.status === 'active'
            ? 'Em andamento'
            : 'A começar'}
      </span>
      {champion && (
        <span className="flex basis-full items-center gap-1.5 text-bulb">
          <Trophy weight="fill" aria-hidden="true" className="size-3.5" />
          Campeão: {champion.club.name} · decidido em{' '}
          {formatGameDate(champion.decidedOn)}
        </span>
      )}
    </div>
  );
}

/**
 * Horizontal, snapping tab strip for phones (the Ranking's decision): the
 * active tab scrolls to view, arrows move between tabs, 44px tall.
 */
function ScrollTabs({
  label,
  items,
  value,
  onChange,
  size = 'md',
}: {
  label: string;
  items: readonly { id: string; label: string; mark?: string | undefined }[];
  value: string;
  onChange(id: string): void;
  size?: 'md' | 'sm';
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    // jsdom has no scrollIntoView; browsers centre the active tab.
    active?.scrollIntoView?.({
      inline: 'center',
      block: 'nearest',
      behavior: 'auto',
    });
  }, [value]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    const delta =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0 && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + delta + items.length) % items.length;
    const target = items[next];
    if (!target) return;
    onChange(target.id);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${target.id}"]`)
      ?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="-mx-[var(--px)] flex snap-x snap-mandatory gap-2 overflow-x-auto px-[var(--px)] py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-tab-id={item.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'btn-px flex min-h-11 shrink-0 snap-center flex-col items-center justify-center gap-0.5 px-3 normal-case leading-tight',
              size === 'sm' ? 'text-[.45rem]' : 'text-[.5rem]',
              selected ? 'btn-grass' : 'btn-chalk',
            )}
          >
            <span>{item.label}</span>
            {item.mark && (
              <span className="text-[.4rem] opacity-80">{item.mark}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StagePanel({
  stage,
  club,
  caption,
}: {
  stage: TableStageView;
  club: string;
  caption: string;
}) {
  if (stage.kind === 'league') {
    const group = stage.groups[0];
    if (!group || group.rows.length === 0)
      return (
        <p className="panel p-4 text-sm text-muted-foreground">
          A tabela aparece depois da primeira rodada.
        </p>
      );
    return (
      <section aria-label={caption} className="panel p-3 sm:p-4">
        <LeagueTable group={group} club={club} caption={caption} />
        <ZoneLegend group={group} />
      </section>
    );
  }
  if (stage.kind === 'groups') {
    const groups = orderedGroups(stage, club);
    if (groups.length === 0) return <Undecided stage={stage} />;
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {groups.map((group) => {
          const mine = group.rows.some((row) => row.club.name === club);
          return (
            <section
              key={group.id}
              aria-label={`${caption} · ${group.name}`}
              className={cn(
                'panel p-3 sm:p-4',
                mine && 'border-l-8 border-bulb',
              )}
            >
              <h3 className="mb-2 flex items-center justify-between font-pixel text-[.6rem]">
                {group.name}
                {mine && (
                  <span className="rounded-sm bg-bulb px-1.5 py-0.5 text-[.4rem] text-bulb-foreground">
                    meu grupo
                  </span>
                )}
              </h3>
              <LeagueTable
                group={group}
                club={club}
                caption={`${caption} · ${group.name}`}
                compact
              />
              <ZoneLegend group={group} />
            </section>
          );
        })}
      </div>
    );
  }
  if (stage.ties.length === 0) return <Undecided stage={stage} />;
  return (
    <section aria-label={caption} className="grid gap-3">
      {stage.byes.length > 0 && <Byes byes={stage.byes} />}
      <ol
        aria-label={`Confrontos · ${caption}`}
        className="grid gap-3 lg:grid-cols-2"
      >
        {stage.ties.map((item) => (
          <TieCard key={item.id} tie={item} club={club} />
        ))}
      </ol>
    </section>
  );
}

function Undecided({ stage }: { stage: TableStageView }) {
  return (
    <div className="panel grid gap-2 p-4">
      <p className="font-pixel text-[.55rem] text-ink">
        {stage.name}: {STAGE_STATUS_LABEL[stage.status].toLowerCase()}
      </p>
      <p className="text-sm text-muted-foreground">
        Os confrontos aparecem aqui depois do sorteio, quando a fase anterior
        terminar.
      </p>
      {stage.byes.length > 0 && <Byes byes={stage.byes} />}
    </div>
  );
}

function Byes({ byes }: { byes: readonly TableClubRef[] }) {
  return (
    <p className="panel-board px-3 py-2 text-xs">
      <span className="font-pixel text-[.45rem] text-bulb">Entram direto:</span>{' '}
      {byes.map((item) => item.name).join(', ')}
    </p>
  );
}

const cell = 'py-2 pl-1.5 text-right whitespace-nowrap tabular-nums';
const head = 'pb-1.5 pl-1.5 text-right font-bold whitespace-nowrap';
const wide = 'hidden min-[414px]:table-cell';

/**
 * Teletext table: #, club, J, (V/E/D from 414px), SG, Pts. The zone band
 * sits at the left of the position; the managed club is `aria-current`.
 */
export function LeagueTable({
  group,
  club,
  caption,
  compact = false,
}: {
  group: TableGroupView;
  club: string;
  caption: string;
  /** Groups: shorter club names so four panels fit a phone. */
  compact?: boolean;
}) {
  return (
    <table className="teletext w-full text-[.5rem] sm:text-[.6rem]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="bg-board text-left text-bulb">
          <th scope="col" className="pb-1.5 pl-1 font-bold">
            #
          </th>
          <th scope="col" className="w-full max-w-0 pb-1.5 font-bold">
            Clube
          </th>
          <th scope="col" className={head}>
            J
          </th>
          <th scope="col" className={cn(head, wide)}>
            V
          </th>
          <th scope="col" className={cn(head, wide)}>
            E
          </th>
          <th scope="col" className={cn(head, wide)}>
            D
          </th>
          <th scope="col" className={head}>
            SG
          </th>
          <th scope="col" className={cn(head, 'pr-1')}>
            Pts
          </th>
        </tr>
      </thead>
      <tbody>
        {group.rows.map((row) => {
          const isMine = row.club.name === club;
          const zone = zoneOf(group, row);
          const short = compact
            ? shortClubName(row.club.name, 11)
            : row.club.name;
          return (
            <tr
              key={row.club.id}
              className={cn('border-t-2', isMine && 'bg-bulb/50')}
              {...(isMine ? { 'aria-current': 'true' as const } : {})}
            >
              <td className="relative py-2 pr-1.5 pl-2.5">
                <ZoneBand zone={zone} />
                {row.position}
              </td>
              <td className="w-full max-w-0 py-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <ClubEmblem
                    name={row.club.name}
                    id={row.club.id}
                    size={compact ? 16 : 18}
                    decorative
                  />
                  <span
                    className={cn(
                      'truncate',
                      isMine && 'font-bold text-primary',
                    )}
                    title={row.club.name}
                  >
                    {short === row.club.name ? (
                      row.club.name
                    ) : (
                      <>
                        <span aria-hidden="true">{short}</span>
                        <span className="sr-only">{row.club.name}</span>
                      </>
                    )}
                  </span>
                </span>
              </td>
              <td className={cell}>{row.played}</td>
              <td className={cn(cell, wide)}>{row.won}</td>
              <td className={cn(cell, wide)}>{row.drawn}</td>
              <td className={cn(cell, wide)}>{row.lost}</td>
              <td className={cell}>
                {row.goalDifference > 0
                  ? `+${String(row.goalDifference)}`
                  : row.goalDifference}
              </td>
              <td className={cn(cell, 'pr-1 font-bold')}>{row.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Coloured band at the left of the position (legend names the zone). */
export function ZoneBand({ zone }: { zone: TableZoneKind | undefined }) {
  if (!zone) return null;
  return (
    <span
      aria-hidden="true"
      data-zone={zone}
      className={cn('absolute top-0 bottom-0 left-0 w-1.5', ZONE_TONE[zone])}
    />
  );
}

export function ZoneLegend({
  group,
  only,
}: {
  group: TableGroupView;
  /** Restrict to zones among these positions (Central window). */
  only?: readonly TableZoneKind[] | undefined;
}) {
  const items = legendOf(group).filter(
    (item) => !only || only.includes(item.kind),
  );
  if (items.length === 0) return null;
  return (
    <ul
      aria-label="Zonas da tabela"
      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-pixel text-[.45rem] text-muted-foreground"
    >
      {items.map((item) => (
        <li key={item.kind} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              'inline-block size-2.5 border border-ink',
              ZONE_TONE[item.kind],
            )}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * One tie as a two-row scoreboard: each club with its goals in the first
 * leg, the return leg and the aggregate; the winner on bulb, the tiebreak
 * named when the aggregate was level.
 */
function TieCard({ tie, club }: { tie: TieView; club: string }) {
  const summary = tieSummary(tie);
  const mine = summary.involves(club);
  const goalsOf = (side: TableClubRef, legIndex: number) => {
    const leg = tie.legs[legIndex];
    if (!leg || leg.homeGoals === undefined || leg.awayGoals === undefined)
      return '–';
    return String(leg.homeClubId === side.id ? leg.homeGoals : leg.awayGoals);
  };
  const aggregateOf = (side: TableClubRef) =>
    tie.aggregate
      ? String(
          side.id === tie.home.id ? tie.aggregate.home : tie.aggregate.away,
        )
      : '–';
  const nextLeg = tie.legs.find((leg) => leg.homeGoals === undefined);
  const row = (side: TableClubRef) => {
    const winner = summary.winner?.id === side.id;
    const isMine = side.name === club;
    return (
      <tr
        className={cn('border-t-2', winner && 'bg-bulb/50')}
        {...(isMine ? { 'aria-current': 'true' as const } : {})}
      >
        <th
          scope="row"
          className="w-full max-w-0 py-2 pl-1 text-left font-normal"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <ClubEmblem name={side.name} id={side.id} size={18} decorative />
            <span
              className={cn('truncate', (winner || isMine) && 'font-bold')}
              title={side.name}
            >
              {side.name}
            </span>
            {winner && <span className="sr-only">(classificado)</span>}
          </span>
        </th>
        {tie.legs.map((leg, index) => (
          <td key={leg.fixtureId} className={cell}>
            {goalsOf(side, index)}
          </td>
        ))}
        {tie.legs.length > 1 && (
          <td className={cn(cell, 'pr-1 font-bold')}>{aggregateOf(side)}</td>
        )}
      </tr>
    );
  };
  return (
    <li
      className={cn('panel p-3', mine && 'border-l-8 border-bulb')}
      aria-label={`${tie.home.name} × ${tie.away.name}`}
    >
      <table className="teletext w-full text-[.5rem] sm:text-[.6rem]">
        <thead>
          <tr className="bg-board text-left text-bulb">
            <th scope="col" className="pb-1.5 pl-1 font-bold">
              Confronto
            </th>
            {summary.legs.map((leg) => (
              <th key={leg.label} scope="col" className={head}>
                {leg.label}
              </th>
            ))}
            {tie.legs.length > 1 && (
              <th scope="col" className={cn(head, 'pr-1')}>
                Agr.
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {row(tie.home)}
          {row(tie.away)}
        </tbody>
      </table>
      <p className="mt-2 font-pixel text-[.45rem] text-muted-foreground">
        {summary.winner ? (
          <>
            <span className="text-ink">
              Classificado: {summary.winner.name}
            </span>
            {summary.decidedByTiebreak && ' · no desempate'}
          </>
        ) : tie.status === 'scheduled' ? (
          nextLeg ? (
            `${summary.legs[0]?.label ?? 'Jogo'} em ${formatGameDate(nextLeg.date)}`
          ) : (
            'Datas a definir'
          )
        ) : nextLeg ? (
          `${summary.legs.find((leg) => leg.date === nextLeg.date)?.label ?? 'Volta'} em ${formatGameDate(nextLeg.date)}`
        ) : (
          'Aguardando o resultado'
        )}
      </p>
    </li>
  );
}

/**
 * League of the career read model (`career.standings`): the fallback when
 * the server has no tables route. V/E/D from 414px, SG always, the coach's
 * club highlighted.
 */
export function LeagueStandings({ career }: { career: CareerView }) {
  const rows = career.standings
    .slice()
    .sort((a, b) => a.position - b.position || b.points - a.points);
  const hasRecord = rows.some((row) => row.won !== undefined);
  return (
    <section aria-labelledby="classificacao-titulo" className="panel p-4">
      <h2 id="classificacao-titulo" className="font-pixel text-[.65rem]">
        Classificação
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {career.division ?? 'Liga'} · rodada {career.round}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          A tabela aparece depois da primeira rodada.
        </p>
      ) : (
        <table className="teletext mt-3 w-full text-[.5rem] sm:text-[.6rem]">
          <caption className="sr-only">
            Classificação completa
            {career.division ? ` · ${career.division}` : ''}
          </caption>
          <thead>
            <tr className="bg-board text-left text-bulb">
              <th scope="col" className="pb-1.5 pl-1 font-bold">
                #
              </th>
              <th scope="col" className="w-full max-w-0 pb-1.5 font-bold">
                Clube
              </th>
              <th scope="col" className={head}>
                J
              </th>
              {hasRecord && (
                <>
                  <th scope="col" className={cn(head, wide)}>
                    V
                  </th>
                  <th scope="col" className={cn(head, wide)}>
                    E
                  </th>
                  <th scope="col" className={cn(head, wide)}>
                    D
                  </th>
                  <th scope="col" className={head}>
                    SG
                  </th>
                </>
              )}
              <th scope="col" className={cn(head, 'pr-1')}>
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isMine = row.club === career.club;
              const diff = row.goalDifference ?? 0;
              return (
                <tr
                  key={row.club}
                  className={cn('border-t-2', isMine && 'bg-bulb/50')}
                  {...(isMine ? { 'aria-current': 'true' as const } : {})}
                >
                  <td className="py-2 pr-1.5 pl-1">
                    {row.position || index + 1}
                  </td>
                  <td className="w-full max-w-0 py-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ClubEmblem name={row.club} size={18} decorative />
                      <span
                        className={cn(
                          'truncate',
                          isMine && 'font-bold text-primary',
                        )}
                        title={row.club}
                      >
                        {row.club}
                      </span>
                    </span>
                  </td>
                  <td className={cell}>{row.played}</td>
                  {hasRecord && (
                    <>
                      <td className={cn(cell, wide)}>{row.won ?? 0}</td>
                      <td className={cn(cell, wide)}>{row.drawn ?? 0}</td>
                      <td className={cn(cell, wide)}>{row.lost ?? 0}</td>
                      <td className={cell}>
                        {diff > 0 ? `+${String(diff)}` : diff}
                      </td>
                    </>
                  )}
                  <td className={cn(cell, 'pr-1 font-bold')}>{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
