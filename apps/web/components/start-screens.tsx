'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  CircleNotch,
  FolderOpen,
  Play,
  Plus,
  SignOut,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { Brand } from '@/components/brand';
import { ClubEmblem, stableHash } from '@/components/club-emblem';
import { Button } from '@/components/ui/button';
import {
  FREE_CAREER_LIMIT,
  LICENSE_CAREER_LIMIT,
  type CareerList,
  type CareerSummary,
  type PublicStats,
} from '@/lib/career-api';
import { cn } from '@/lib/utils';

export interface PlayerIdentity {
  readonly name: string;
  readonly avatarUrl?: string;
}

const numberFormat = new Intl.NumberFormat('pt-BR');

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (
    parts.length === 1
      ? parts[0]!.slice(0, 2)
      : parts[0]![0]! + parts.at(-1)![0]!
  ).toUpperCase();
}

/** Big coach avatar: the provider picture or deterministic initials. */
export function PlayerAvatar({
  player,
  size = 'lg',
}: {
  player: PlayerIdentity;
  size?: 'md' | 'lg';
}) {
  const hue = stableHash(player.name.toLowerCase()) % 360;
  const box = size === 'lg' ? 'size-36 sm:size-44' : 'size-14';
  return (
    <span
      className={cn('avatar-ring inline-grid rounded-full p-1.5', box)}
      role="img"
      aria-label={`Avatar de ${player.name}`}
    >
      {player.avatarUrl ? (
        // Provider avatars come from arbitrary hosts; next/image would need
        // remote patterns in next.config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full rounded-full border-4 border-background object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'grid size-full place-items-center rounded-full border-4 border-background font-display font-bold uppercase text-white',
            size === 'lg' ? 'text-6xl sm:text-7xl' : 'text-xl',
          )}
          style={{
            background: `linear-gradient(140deg, hsl(${hue} 55% 38%), hsl(${(hue + 40) % 360} 60% 22%))`,
          }}
        >
          {initialsOf(player.name)}
        </span>
      )}
    </span>
  );
}

function StartFrame({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut?: (() => void) | undefined;
}) {
  return (
    <main className="arcade-hero min-h-dvh px-4 pb-10 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Brand />
        {onSignOut && (
          <Button variant="ghost" className="min-h-11" onClick={onSignOut}>
            <SignOut data-icon="inline-start" />
            Sair
          </Button>
        )}
      </div>
      {children}
    </main>
  );
}

/** Início: after sign-in, before entering a career. */
export function StartScreen({
  player,
  loadStats,
  error = '',
  onNewCareer,
  onLoadCareer,
  onSignOut,
}: {
  player: PlayerIdentity;
  loadStats(): Promise<PublicStats | null>;
  error?: string;
  onNewCareer(): void;
  onLoadCareer(): void;
  onSignOut?: (() => void) | undefined;
}) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  useEffect(() => {
    let active = true;
    loadStats()
      .then((value) => active && setStats(value))
      .catch(() => active && setStats(null));
    return () => {
      active = false;
    };
  }, [loadStats]);

  return (
    <StartFrame onSignOut={onSignOut}>
      <div className="mx-auto mt-8 grid max-w-5xl items-center gap-10 lg:mt-16 lg:grid-cols-[1.1fr_.9fr]">
        <section
          aria-labelledby="inicio-titulo"
          className="flex flex-col items-center text-center lg:items-start lg:text-left"
        >
          <PlayerAvatar player={player} />
          <p className="mt-6 text-xs font-bold uppercase tracking-[.24em] text-primary">
            Beira do campo
          </p>
          <h1
            id="inicio-titulo"
            className="mt-1 font-display text-4xl font-bold uppercase leading-none sm:text-6xl"
          >
            E aí, {player.name}!
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
            Monte seu time, sobreviva à diretoria e escreva sua história. A
            rodada cabe no intervalo.
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 flex items-center gap-2 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm"
            >
              <WarningCircle className="text-destructive" weight="fill" />
              {error}
            </p>
          )}
          <div className="mt-8 grid w-full max-w-md gap-3">
            <button
              type="button"
              className="play-button flex min-h-16 items-center justify-center gap-3 px-6 font-display text-2xl font-bold uppercase tracking-wide"
              onClick={onNewCareer}
            >
              <Plus weight="bold" className="size-6" aria-hidden="true" />
              Nova carreira
            </button>
            <Button
              variant="outline"
              className="min-h-14 font-display text-xl font-bold uppercase tracking-wide"
              onClick={onLoadCareer}
            >
              <FolderOpen data-icon="inline-start" weight="duotone" />
              Carregar carreira
            </Button>
          </div>
        </section>
        {stats && <Counters stats={stats} />}
      </div>
    </StartFrame>
  );
}

function Counters({ stats }: { stats: PublicStats }) {
  const items = [
    [stats.coaches === 1 ? 'treinador' : 'treinadores', stats.coaches],
    [stats.clubs === 1 ? 'clube' : 'clubes', stats.clubs],
    [stats.athletes === 1 ? 'atleta' : 'atletas', stats.athletes],
  ] as const;
  return (
    <section aria-labelledby="contadores-titulo" className="w-full">
      <h2
        id="contadores-titulo"
        className="mb-3 text-center text-xs font-bold uppercase tracking-[.24em] text-muted-foreground lg:text-left"
      >
        No gramado agora
      </h2>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="counter-tile flex flex-col items-center rounded-xl border px-2 py-4 lg:flex-row lg:justify-between lg:px-5"
          >
            <dt className="order-2 text-[.7rem] font-bold uppercase tracking-wider text-muted-foreground lg:order-1 lg:text-sm">
              {label}
            </dt>
            <dd className="order-1 font-display text-3xl font-bold tabular-nums text-primary sm:text-4xl lg:order-2 lg:text-5xl">
              {numberFormat.format(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatGameDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function formatUpdated(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

export function careerTitle(career: CareerSummary): string {
  return career.name ?? `Carreira de ${career.coach}`;
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; list: CareerList };

/** Carregar Carreira: the player's careers, open or delete, plan limit. */
export function LoadCareerScreen({
  load,
  remove,
  onOpen,
  onNewCareer,
  onBack,
  notice = '',
  error = '',
  onSignOut,
}: {
  load(): Promise<CareerList>;
  remove(careerId: string): Promise<void>;
  onOpen(career: CareerSummary): void;
  onNewCareer(): void;
  onBack(): void;
  /** Message from a refused creation (CAREER_LIMIT_REACHED). */
  notice?: string;
  error?: string;
  onSignOut?: (() => void) | undefined;
}) {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const refresh = useCallback(async () => {
    try {
      setState({ status: 'ready', list: await load() });
    } catch (caught) {
      setState({
        status: 'error',
        message:
          caught instanceof Error
            ? caught.message
            : 'Não foi possível carregar suas carreiras.',
      });
    }
  }, [load]);

  useEffect(() => {
    let active = true;
    load()
      .then((list) => active && setState({ status: 'ready', list }))
      .catch(
        (caught: unknown) =>
          active &&
          setState({
            status: 'error',
            message:
              caught instanceof Error
                ? caught.message
                : 'Não foi possível carregar suas carreiras.',
          }),
      );
    return () => {
      active = false;
    };
  }, [load]);

  const confirmDelete = async (career: CareerSummary) => {
    setDeleting(true);
    try {
      await remove(career.id);
      setConfirming(null);
      setAnnouncement(`${careerTitle(career)} foi excluída.`);
      await refresh();
    } catch (caught) {
      setAnnouncement(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível excluir a carreira.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const careers = state.status === 'ready' ? state.list.careers : [];
  const limit = state.status === 'ready' ? state.list.limit : undefined;

  return (
    <StartFrame onSignOut={onSignOut}>
      <section
        aria-labelledby="carregar-titulo"
        className="mx-auto mt-6 max-w-3xl"
      >
        <Button variant="ghost" className="-ml-2 min-h-11" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Voltar ao início
        </Button>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.24em] text-primary">
              Vestiário
            </p>
            <h1
              id="carregar-titulo"
              className="font-display text-4xl font-bold uppercase leading-none sm:text-5xl"
            >
              Carregar carreira
            </h1>
          </div>
          <Button className="min-h-11" onClick={onNewCareer}>
            <Plus data-icon="inline-start" weight="bold" />
            Nova carreira
          </Button>
        </div>

        <PlanNotice used={careers.length} limit={limit} notice={notice} />
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}
        <p aria-live="polite" role="status" className="sr-only">
          {announcement}
        </p>

        {state.status === 'loading' ? (
          <p
            role="status"
            aria-live="polite"
            className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <CircleNotch className="size-5 animate-spin text-primary" />
            Buscando suas carreiras…
          </p>
        ) : state.status === 'error' ? (
          <div role="alert" className="mt-6 rounded-xl border p-5">
            <p className="text-sm">{state.message}</p>
            <Button
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => {
                setState({ status: 'loading' });
                void refresh();
              }}
            >
              Tentar novamente
            </Button>
          </div>
        ) : careers.length === 0 ? (
          <div className="arcade-panel mt-6 rounded-xl border p-8 text-center">
            <p className="font-display text-2xl font-bold uppercase">
              Nenhuma carreira salva
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha um clube e comece sua primeira temporada.
            </p>
            <Button className="mt-5 min-h-11" onClick={onNewCareer}>
              <Plus data-icon="inline-start" weight="bold" />
              Começar nova carreira
            </Button>
          </div>
        ) : (
          <ul aria-label="Suas carreiras" className="mt-6 flex flex-col gap-3">
            {careers.map((career) => (
              <CareerRow
                key={career.id}
                career={career}
                confirming={confirming === career.id}
                deleting={deleting && confirming === career.id}
                onOpen={() => onOpen(career)}
                onAskDelete={() => setConfirming(career.id)}
                onCancelDelete={() => setConfirming(null)}
                onConfirmDelete={() => void confirmDelete(career)}
              />
            ))}
          </ul>
        )}
      </section>
    </StartFrame>
  );
}

function PlanNotice({
  used,
  limit,
  notice,
}: {
  used: number;
  limit: number | undefined;
  notice: string;
}) {
  return (
    <div
      className={cn(
        'mt-5 rounded-xl border px-4 py-3 text-sm',
        notice ? 'border-accent/60 bg-accent/10' : 'bg-card/60',
      )}
    >
      {notice && (
        <p role="alert" className="mb-1 flex items-start gap-2 font-medium">
          <WarningCircle
            className="mt-0.5 shrink-0 text-accent"
            weight="fill"
          />
          {notice}
        </p>
      )}
      <p className="text-muted-foreground">
        {limit !== undefined && (
          <strong className="text-foreground">
            {used} de {limit} {limit === 1 ? 'carreira' : 'carreiras'} ·{' '}
          </strong>
        )}
        Plano grátis: {FREE_CAREER_LIMIT} carreira. Licença única: até{' '}
        {LICENSE_CAREER_LIMIT}.
      </p>
    </div>
  );
}

function CareerRow({
  career,
  confirming,
  deleting,
  onOpen,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  career: CareerSummary;
  confirming: boolean;
  deleting: boolean;
  onOpen(): void;
  onAskDelete(): void;
  onCancelDelete(): void;
  onConfirmDelete(): void;
}) {
  const title = careerTitle(career);
  const dialogTitle = useId();
  const dialogText = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (wasConfirming.current) deleteButton.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const details = [
    career.season ? `Temporada ${career.season}` : undefined,
    career.currentDate ? formatGameDate(career.currentDate) : undefined,
    career.round ? `Rodada ${career.round}` : undefined,
  ].filter(Boolean);

  return (
    <li className="arcade-panel overflow-hidden rounded-xl border">
      <div className="grid grid-cols-[auto_1fr] items-center gap-4 p-4 sm:grid-cols-[auto_1fr_auto]">
        <ClubEmblem
          name={career.clubName ?? career.coach}
          size={56}
          decorative
        />
        <div className="min-w-0">
          <h2 className="truncate font-display text-2xl font-bold uppercase leading-tight">
            {title}
          </h2>
          <p className="truncate text-sm font-medium">
            {career.clubName ?? 'Clube a escolher'} · {career.coach}
          </p>
          <p className="text-xs text-muted-foreground">
            {details.join(' · ')}
            {career.updatedAt && (
              <>
                {details.length > 0 && ' · '}
                Atualizada em {formatUpdated(career.updatedAt)}
              </>
            )}
          </p>
        </div>
        <div className="col-span-2 grid grid-cols-[1fr_auto] gap-2 sm:col-span-1">
          <Button
            className="min-h-11"
            onClick={onOpen}
            aria-label={`Abrir ${title}`}
            disabled={confirming}
          >
            <Play data-icon="inline-start" weight="fill" />
            Abrir
          </Button>
          <Button
            ref={deleteButton}
            variant="outline"
            className="min-h-11"
            onClick={onAskDelete}
            aria-label={`Excluir ${title}`}
            aria-expanded={confirming}
            disabled={confirming}
          >
            <Trash data-icon="inline-start" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        </div>
      </div>
      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby={dialogTitle}
          aria-describedby={dialogText}
          className="border-t border-destructive/50 bg-destructive/10 p-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancelDelete();
          }}
        >
          <p
            id={dialogTitle}
            className="font-display text-lg font-bold uppercase"
          >
            Excluir carreira?
          </p>
          <p id={dialogText} className="text-sm">
            {title} será apagada para sempre, com elenco, títulos e histórico.
            Essa ação não pode ser desfeita.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              ref={cancel}
              variant="outline"
              className="min-h-11"
              onClick={onCancelDelete}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="min-h-11 text-white"
              onClick={onConfirmDelete}
              disabled={deleting}
            >
              <Trash data-icon="inline-start" />
              {deleting ? 'Excluindo…' : 'Sim, excluir carreira'}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
