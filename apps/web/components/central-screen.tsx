'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDots,
  CheckCircle,
  ClipboardText,
  EnvelopeSimple,
  Lightning,
  Newspaper,
  ShieldWarning,
} from '@phosphor-icons/react';
import { ClubEmblem } from '@/components/club-emblem';
import { CoachAvatar } from '@/components/coach-avatar';
import { InboxDecisions } from '@/components/inbox-decisions';
import { PixelBall, PixelWhistle } from '@/components/retro/sprites';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { CareerView, Screen } from '@/lib/career-api';
import { countryName, flagEmoji, personalityLabel } from '@/lib/coach-profile';
import type {
  CompetitionProductPort,
  CompetitionProductView,
} from '@/lib/competition-product';
import type { InboxPort } from '@/lib/inbox-product';
import { cn } from '@/lib/utils';

type CalendarEntry = CompetitionProductView['calendar']['entries'][number];

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatFixtureDate(date: string): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(value);
}

/** Central: the career's main screen (replaces the old overview). */
export function CentralScreen({
  career,
  calendar,
  inbox,
  onInboxResolved,
  onNarrate,
  onInstant,
  navigate,
}: {
  career: CareerView;
  /** Season calendar (competition read model); hidden when absent. */
  calendar?: CompetitionProductPort | undefined;
  /** E-mails with decisions; without it the legacy summary is shown. */
  inbox?: InboxPort | undefined;
  onInboxResolved?: (() => void) | undefined;
  onNarrate(): void;
  onInstant(): void;
  navigate(value: Screen): void;
}) {
  return (
    <div className="grid gap-4">
      <ClubCard career={career} />
      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,.8fr)_minmax(0,1.4fr)_minmax(15rem,.8fr)]">
        <div className="lg:order-2">
          <NextMatch
            career={career}
            onNarrate={onNarrate}
            onInstant={onInstant}
            onReview={() => navigate('tactics')}
          />
        </div>
        <div className="lg:order-1">
          <StandingsSummary career={career} onOpen={() => navigate('table')} />
        </div>
        <div className="lg:order-3">
          <Upcoming
            career={career}
            port={calendar}
            onOpen={() => navigate('calendar')}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {inbox ? (
          <InboxDecisions
            port={inbox}
            navigate={navigate}
            {...(onInboxResolved ? { onResolved: onInboxResolved } : {})}
          />
        ) : (
          <Inbox career={career} navigate={navigate} />
        )}
        <News career={career} onOpen={() => navigate('inbox')} />
      </div>
    </div>
  );
}

function ClubCard({ career }: { career: CareerView }) {
  const board = career.world.board;
  const row = career.standings.find((item) => item.club === career.club);
  return (
    <section
      aria-labelledby="central-clube"
      className="panel grid gap-5 p-5 sm:p-6 lg:grid-cols-2 lg:items-center"
    >
      <div className="flex min-w-0 items-center gap-4">
        <ClubEmblem name={career.club} size={84} />
        <div className="min-w-0">
          <ClubTitle career={career} />
        </div>
      </div>
      <CoachBadge career={career} />
      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4 lg:col-span-2">
        <CardStat
          label="Posição"
          value={row ? `${row.position}º` : '—'}
          {...(row ? { hint: `${row.points} pts` } : {})}
        />
        <CardStat
          label="Caixa"
          value={money.format(career.world.finances.cash)}
        />
        <CardMeter label="Diretoria" value={board.confidence} />
        <CardMeter label="Torcida" value={board.fanConfidence} />
      </dl>
    </section>
  );
}

function ClubTitle({ career }: { career: CareerView }) {
  return (
    <>
      <p className="truncate font-pixel text-[.5rem] text-muted-foreground">
        {career.careerName ? `${career.careerName} · ` : ''}
        {career.division ?? 'Temporada'} · Rodada {career.round}
      </p>
      <h2
        id="central-clube"
        className="truncate font-pixel text-base leading-relaxed sm:text-2xl"
      >
        {career.club}
      </h2>
      <p className="mt-1 truncate text-sm text-muted-foreground">
        Objetivo: {career.world.board.objective}
      </p>
    </>
  );
}

/** Coach identity: avatar, name, nationality and personality. */
function CoachBadge({ career }: { career: CareerView }) {
  const profile = career.coachProfile;
  return (
    <div
      aria-label="Treinador"
      role="group"
      className="flex min-w-0 items-center gap-3 border-2 border-ink bg-popover p-2.5"
    >
      {profile && <CoachAvatar avatar={profile.avatar} size={52} />}
      <div className="min-w-0 text-sm">
        <p className="font-pixel text-[.5rem] text-muted-foreground">
          Treinador
        </p>
        <p className="truncate text-base font-extrabold">
          {profile && (
            <span aria-hidden="true">{flagEmoji(profile.nationality)} </span>
          )}
          {career.coach}
          {profile && (
            <span className="sr-only">
              , {countryName(profile.nationality)}
            </span>
          )}
        </p>
        {profile && (
          <p className="truncate text-sm">
            Personalidade:{' '}
            <strong>{personalityLabel(profile.personality)}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

function CardStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-pixel text-[.5rem] text-muted-foreground">{label}</dt>
      <dd className="font-pixel text-xs leading-relaxed whitespace-nowrap min-[400px]:text-base sm:text-xl">
        {value}
        {hint && (
          <span className="ml-1 text-xs text-muted-foreground">{hint}</span>
        )}
      </dd>
    </div>
  );
}

function CardMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-pixel text-[.5rem] text-muted-foreground">{label}</dt>
      <dd>
        <span className="font-pixel text-base leading-relaxed sm:text-xl">
          {value}%
        </span>
        <Progress
          value={value}
          aria-label={`Confiança da ${label.toLowerCase()}: ${value}%`}
          className="mt-1 h-1.5"
        />
      </dd>
    </div>
  );
}

function NextMatch({
  career,
  onNarrate,
  onInstant,
  onReview,
}: {
  career: CareerView;
  onNarrate(): void;
  onInstant(): void;
  onReview(): void;
}) {
  const fixture = career.fixture;
  const starters = career.players.filter((player) => player.role === 'starter');
  const unavailable = career.players.filter(
    (player) => player.injuryRounds > 0 || player.suspended,
  );
  const average = Math.round(
    starters.reduce((sum, player) => sum + player.strength, 0) /
      Math.max(1, starters.length),
  );
  const away = fixture?.venue === 'away';
  const home = away ? career.opponent.club : career.club;
  const visitor = away ? career.club : career.opponent.club;

  if (!fixture)
    return (
      <section
        aria-labelledby="proximo-jogo-central"
        className="panel-board flex h-full flex-col justify-center p-6 text-center"
      >
        <h2 id="proximo-jogo-central" className="led text-sm">
          Sem jogo marcado
        </h2>
        <p className="mt-1 text-sm text-chalk/70">
          O calendário não tem partida pendente para o seu clube agora.
        </p>
      </section>
    );

  return (
    <section
      aria-labelledby="proximo-jogo-central"
      className="panel-board overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
        <Badge variant="bulb">Próximo jogo</Badge>
        <span className="font-pixel text-[.5rem] text-chalk/70">
          {fixture.competition}
          {fixture.date && ` · ${formatFixtureDate(fixture.date)}`} ·{' '}
          {away ? 'fora de casa' : 'em casa'}
        </span>
      </div>
      <h2 id="proximo-jogo-central" className="sr-only">
        Próximo jogo: {home} × {visitor}
      </h2>
      <div
        aria-hidden="true"
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-5"
      >
        <TeamSide name={home} />
        <span className="led text-2xl sm:text-4xl">VS</span>
        <TeamSide name={visitor} />
      </div>
      <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-[1.4fr_1fr]">
        <button
          type="button"
          className="btn-px btn-play col-span-2 flex min-h-16 items-center justify-center gap-3 px-5 text-sm sm:col-span-1 sm:row-span-2 sm:text-base"
          onClick={onNarrate}
        >
          <PixelBall size={22} />
          Jogar partida
        </button>
        <Button
          variant="outline"
          className="h-auto min-h-12 whitespace-normal"
          onClick={onInstant}
        >
          <Lightning weight="fill" data-icon="inline-start" />
          Resultado instantâneo
        </Button>
        <Button
          variant="outline"
          className="min-h-12"
          onClick={onReview}
          aria-label="Revisar escalação e tática"
        >
          <ClipboardText data-icon="inline-start" />
          Revisar
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 border-y-4 border-wood-deep bg-ink/40 px-5 py-3 text-center">
        <MiniStat label="Nossa força" value={String(average)} />
        <MiniStat
          label="Adversário"
          value={`≈ ${career.opponent.approximateStrength}`}
        />
        <MiniStat label="Formação" value={career.formation} />
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-pixel text-[.6rem] text-bulb">
            <PixelWhistle size={14} />
            Raio-X do rival
          </h3>
          <div
            className="flex gap-1"
            aria-label={`Forma recente: ${career.opponent.form.join(', ') || 'sem jogos'}`}
          >
            {career.opponent.form.map((result, index) => (
              <Badge
                key={`${result}-${index}`}
                variant={result === 'V' ? 'default' : 'secondary'}
              >
                {result}
              </Badge>
            ))}
          </div>
        </div>
        <p className="text-sm">{career.opponent.report}</p>
        <p className="text-xs text-chalk/70">
          Desfalques: {career.opponent.absences.join(', ') || 'nenhum'}
        </p>
        <ul
          className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
          aria-label="Prontidão"
        >
          <Readiness
            good={starters.length === 11}
            label={`${starters.length}/11 titulares`}
          />
          <Readiness
            good={unavailable.every((player) => player.role !== 'starter')}
            label={`${unavailable.length} indisponível(is)`}
          />
        </ul>
      </div>
    </section>
  );
}

function TeamSide({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <ClubEmblem name={name} size={64} decorative />
      <span className="w-full truncate font-pixel text-[.55rem] leading-relaxed sm:text-xs">
        {name}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-pixel text-[.45rem] text-chalk/70">{label}</p>
      <p className="led text-sm sm:text-base">{value}</p>
    </div>
  );
}

function Readiness({ good, label }: { good: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      {good ? (
        <CheckCircle className="text-bulb" weight="fill" aria-hidden="true" />
      ) : (
        <ShieldWarning
          className="text-accent"
          weight="fill"
          aria-hidden="true"
        />
      )}
      <span>
        <span className="sr-only">{good ? 'Ok: ' : 'Atenção: '}</span>
        {label}
      </span>
    </li>
  );
}

function SideCard({
  title,
  id,
  action,
  onAction,
  children,
}: {
  title: string;
  id: string;
  action: string;
  onAction(): void;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="panel flex h-full flex-col p-4">
      <h2 id={id} className="font-pixel text-[.65rem]">
        {title}
      </h2>
      <div className="mt-3 flex-1">{children}</div>
      <Button
        variant="ghost"
        className="mt-3 min-h-11 justify-between"
        onClick={onAction}
      >
        {action}
        <ArrowRight data-icon="inline-end" />
      </Button>
    </section>
  );
}

function StandingsSummary({
  career,
  onOpen,
}: {
  career: CareerView;
  onOpen(): void;
}) {
  const rows = career.standings
    .slice()
    .sort((a, b) => a.position - b.position || b.points - a.points);
  const top = rows.slice(0, 5);
  const mine = rows.find((row) => row.club === career.club);
  const shown = mine && !top.includes(mine) ? [...top.slice(0, 4), mine] : top;
  return (
    <SideCard
      id="central-tabela"
      title="Tabela"
      action="Ver classificação"
      onAction={onOpen}
    >
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          A tabela aparece depois da primeira rodada.
        </p>
      ) : (
        <table className="teletext w-full">
          <caption className="sr-only">
            Classificação resumida
            {career.division ? ` · ${career.division}` : ''}
          </caption>
          <thead>
            <tr className="bg-board text-left text-bulb">
              <th scope="col" className="w-7 pb-1 font-bold">
                #
              </th>
              <th scope="col" className="pb-1 font-bold">
                Clube
              </th>
              <th scope="col" className="pb-1 text-right font-bold">
                J
              </th>
              <th scope="col" className="pb-1 text-right font-bold">
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const isMine = row.club === career.club;
              return (
                <tr
                  key={row.club}
                  className={cn('border-t-2', isMine && 'bg-bulb/50')}
                  {...(isMine ? { 'aria-current': 'true' as const } : {})}
                >
                  <td className="py-1.5 pl-1">{row.position}</td>
                  <td className="py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <ClubEmblem name={row.club} size={22} decorative />
                      <span
                        className={cn('truncate', isMine && 'text-primary')}
                      >
                        {row.club}
                      </span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {row.played}
                  </td>
                  <td className="py-1.5 pr-1 text-right">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </SideCard>
  );
}

function Upcoming({
  career,
  port,
  onOpen,
}: {
  career: CareerView;
  port: CompetitionProductPort | undefined;
  onOpen(): void;
}) {
  const [entries, setEntries] = useState<readonly CalendarEntry[] | null>(
    port ? null : [],
  );
  useEffect(() => {
    if (!port) return;
    let active = true;
    port
      .load()
      .then(
        (model) =>
          active &&
          setEntries(
            model.calendar.entries
              .filter((entry) => entry.status !== 'played')
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 4),
          ),
      )
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, [port]);

  return (
    <SideCard
      id="central-compromissos"
      title="Próximos compromissos"
      action="Ver calendário"
      onAction={onOpen}
    >
      <ol className="flex flex-col gap-2 text-sm">
        {career.fixture && (
          <li className="flex items-start gap-3 border-2 border-ink bg-bulb/40 p-2">
            <CalendarDots
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="min-w-0">
              <strong className="block truncate">
                {career.fixture.venue === 'away'
                  ? `${career.opponent.club} × ${career.club}`
                  : `${career.club} × ${career.opponent.club}`}
              </strong>
              <small className="text-muted-foreground">
                {career.fixture.competition}
                {career.fixture.date &&
                  ` · ${formatFixtureDate(career.fixture.date)}`}
              </small>
            </span>
          </li>
        )}
        {entries === null ? (
          <li className="text-muted-foreground">Carregando calendário…</li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 p-2">
              <span className="w-12 shrink-0 pt-0.5 font-pixel text-[.5rem] text-primary">
                {formatFixtureDate(entry.date).replace(/^\S+\s/, '')}
              </span>
              <span className="min-w-0">
                <strong className="block truncate">{entry.label}</strong>
                <small className="text-muted-foreground">
                  {entry.competitionName} · {entry.phaseName}
                </small>
              </span>
            </li>
          ))
        )}
        {!career.fixture && entries?.length === 0 && (
          <li className="text-muted-foreground">Nada marcado por enquanto.</li>
        )}
      </ol>
    </SideCard>
  );
}

function Inbox({
  career,
  navigate,
}: {
  career: CareerView;
  navigate(value: Screen): void;
}) {
  const decisions = [
    ...career.world.contractAlerts.map((alert, index) => ({
      id: `contract-${index}`,
      tag: 'Contrato',
      text: alert,
      action: 'Ver contratos',
      to: 'market' as Screen,
    })),
    ...career.world.board.proposals.map((proposal) => ({
      id: `job-${proposal.id}`,
      tag: 'Proposta',
      text: `${proposal.club} (${proposal.division}) quer você: ${proposal.objective}.`,
      action: 'Ver proposta',
      to: 'office' as Screen,
    })),
  ].slice(0, 4);
  return (
    <section aria-labelledby="central-caixa" className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2
          id="central-caixa"
          className="flex items-center gap-2 font-pixel text-[.65rem]"
        >
          <EnvelopeSimple aria-hidden="true" />
          Caixa de entrada
        </h2>
        <Badge variant={decisions.length ? 'default' : 'secondary'}>
          {decisions.length} {decisions.length === 1 ? 'decisão' : 'decisões'}
        </Badge>
      </div>
      {decisions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma decisão pendente. Bom trabalho.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {decisions.map((item) => (
            <li
              key={item.id}
              className="grid gap-2 border-2 border-ink bg-popover p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="text-sm">
                <Badge variant="outline" className="mr-2">
                  {item.tag}
                </Badge>
                {item.text}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10"
                onClick={() => navigate(item.to)}
              >
                {item.action}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function News({ career, onOpen }: { career: CareerView; onOpen(): void }) {
  const news = career.world.news.slice(0, 3);
  return (
    <section
      aria-labelledby="central-noticias"
      className="panel flex flex-col p-4"
    >
      <h2
        id="central-noticias"
        className="flex items-center gap-2 font-pixel text-[.65rem]"
      >
        <Newspaper aria-hidden="true" />
        Notícias
      </h2>
      {news.length === 0 ? (
        <p className="mt-3 flex-1 text-sm text-muted-foreground">
          Sem manchetes por enquanto.
        </p>
      ) : (
        <ul className="mt-3 flex flex-1 flex-col gap-3">
          {news.map((item) => (
            <li key={item.id} className="border-l-4 border-accent pl-3">
              <p className="font-pixel text-[.5rem] text-accent">{item.tag}</p>
              <p className="font-semibold leading-snug">{item.headline}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="ghost"
        className="mt-3 min-h-11 justify-between"
        onClick={onOpen}
      >
        Todas as notícias
        <ArrowRight data-icon="inline-end" />
      </Button>
    </section>
  );
}
