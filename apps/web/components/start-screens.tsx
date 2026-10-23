'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  CircleNotch,
  FolderOpen,
  Lock,
  Play,
  Plus,
  SignOut,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { Brand } from '@/components/brand';
import { ClubEmblem } from '@/components/club-emblem';
import { CoachAvatar } from '@/components/coach-avatar';
import { MuteButton } from '@/components/retro/mute-button';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { ScreenTransition } from '@/components/retro/screen-transition';
import {
  PixelArrow,
  PixelBall,
  PixelFlag,
  PixelTrophy,
} from '@/components/retro/sprites';
import { Button } from '@/components/ui/button';
import {
  FREE_CAREER_LIMIT,
  LICENSE_CAREER_LIMIT,
  type CareerList,
  type CareerSummary,
  type PublicStats,
} from '@/lib/career-api';
import { personalityLabel } from '@/lib/coach-profile';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

export interface PlayerIdentity {
  readonly name: string;
  readonly avatarUrl?: string;
}

const numberFormat = new Intl.NumberFormat('pt-BR');

/** Big coach portrait: the provider picture or a deterministic pixel face. */
export function PlayerAvatar({
  player,
  size = 'lg',
}: {
  player: PlayerIdentity;
  size?: 'md' | 'lg';
}) {
  const pixels = size === 'lg' ? 128 : 56;
  return (
    <span
      className="px-border inline-grid bg-chalk"
      role="img"
      aria-label={`Avatar de ${player.name}`}
      style={{ width: pixels, height: pixels }}
    >
      {player.avatarUrl ? (
        // Provider avatars come from arbitrary hosts; next/image would need
        // remote patterns in next.config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="pixelated size-full object-cover"
        />
      ) : (
        <PixelAvatar
          seed={`jogador-${player.name.toLowerCase()}`}
          size={pixels}
        />
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
    <main className="min-h-dvh px-4 pb-10 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <Brand />
        <div className="flex items-center gap-2">
          <MuteButton />
          {onSignOut && (
            <Button variant="outline" className="min-h-10" onClick={onSignOut}>
              <SignOut data-icon="inline-start" />
              Sair
            </Button>
          )}
        </div>
      </div>
      {children}
    </main>
  );
}

/** Início: the game's title screen, after sign-in and before a career. */
export function StartScreen({
  player,
  loadStats,
  loadCareers,
  error = '',
  onNewCareer,
  onLoadCareer,
  onContinue,
  onSignOut,
}: {
  player: PlayerIdentity;
  loadStats(): Promise<PublicStats | null>;
  /** Saved careers; the most recent one is offered to continue. */
  loadCareers?: () => Promise<CareerList>;
  error?: string;
  onNewCareer(): void;
  onLoadCareer(): void;
  onContinue?: (career: CareerSummary) => void;
  onSignOut?: (() => void) | undefined;
}) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [latest, setLatest] = useState<CareerSummary | null>(null);
  const { play } = useSound();
  useEffect(() => {
    if (!loadCareers) return;
    let active = true;
    loadCareers()
      .then(
        (list) =>
          // A locked career (license refunded) cannot be continued.
          active &&
          setLatest(list.careers.find((career) => !career.locked) ?? null),
      )
      .catch(() => active && setLatest(null));
    return () => {
      active = false;
    };
  }, [loadCareers]);
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
      <ScreenTransition
        id="inicio"
        className="mx-auto mt-6 grid max-w-5xl items-start gap-6 lg:mt-12 lg:grid-cols-[1.1fr_.9fr]"
      >
        <section
          aria-labelledby="inicio-titulo"
          className="panel-board relative overflow-hidden px-4 pb-6 pt-6 text-center sm:px-8"
        >
          <TitleMarquee />
          <p className="led mt-4 text-[.55rem] tracking-[.3em] sm:text-xs">
            Modo carreira
          </p>
          <h2
            aria-hidden="true"
            className="led mt-2 text-3xl leading-none sm:text-6xl"
          >
            Footebas
          </h2>
          <div className="mt-6 flex flex-col items-center gap-3">
            <PlayerAvatar player={player} />
            <h1
              id="inicio-titulo"
              className="font-pixel text-sm leading-relaxed sm:text-xl"
            >
              E aí, {player.name}!
            </h1>
            <p className="max-w-md text-sm text-chalk/80 sm:text-base">
              Monte seu time, sobreviva à diretoria e escreva sua história. A
              rodada cabe no intervalo.
            </p>
          </div>
          {error && (
            <p
              role="alert"
              className="mx-auto mt-4 flex max-w-md items-center gap-2 border-2 border-destructive bg-chalk px-3 py-2 text-left text-sm text-ink"
            >
              <WarningCircle className="text-destructive" weight="fill" />
              {error}
            </p>
          )}
          <p
            aria-hidden="true"
            className="mt-7 flex items-center justify-center gap-3 font-pixel text-[.6rem] text-chalk sm:text-xs"
          >
            <PixelArrow size={14} className="blink" />
            Press start
            <PixelArrow size={14} className="blink -scale-x-100" />
          </p>
          <div className="mx-auto mt-3 grid w-full max-w-sm gap-4">
            <button
              type="button"
              className="btn-px btn-play flex min-h-16 items-center justify-center gap-3 px-6 text-sm sm:text-base"
              onClick={() => {
                play('confirm');
                onNewCareer();
              }}
            >
              <Plus weight="bold" className="size-5" aria-hidden="true" />
              Nova carreira
            </button>
            <button
              type="button"
              className="btn-px btn-chalk flex min-h-14 items-center justify-center gap-3 px-6 text-xs sm:text-sm"
              onClick={() => {
                play('click');
                onLoadCareer();
              }}
            >
              <FolderOpen weight="fill" className="size-5" aria-hidden="true" />
              Carregar carreira
            </button>
          </div>
          <PixelBall
            size={28}
            className="px-bounce absolute bottom-4 left-4 hidden sm:block"
          />
          <PixelFlag
            size={28}
            className="absolute right-4 top-4 hidden sm:block"
          />
        </section>
        <div className="grid gap-6">
          {latest && (
            <LatestCareer
              career={latest}
              {...(onContinue ? { onContinue: () => onContinue(latest) } : {})}
            />
          )}
          {stats && <Counters stats={stats} />}
        </div>
      </ScreenTransition>
    </StartFrame>
  );
}

/** Scrolling stadium ad board on top of the title. */
function TitleMarquee() {
  return (
    <div
      aria-hidden="true"
      className="-mx-4 -mt-6 overflow-hidden border-b-4 border-wood-deep bg-wood py-1 font-pixel text-[.55rem] text-chalk sm:-mx-8"
    >
      <span className="ticker-text">
        Bem-vindo ao estádio · Temporada aberta · Monte seu elenco · Pule para o
        resultado quando quiser · Som opcional ·
      </span>
    </div>
  );
}

/** Most recent career: name, coach avatar and personality. */
function LatestCareer({
  career,
  onContinue,
}: {
  career: CareerSummary;
  onContinue?: () => void;
}) {
  const title = careerTitle(career);
  const profile = career.coachProfile;
  const { play } = useSound();
  return (
    <section aria-labelledby="ultima-carreira" className="panel grid gap-3 p-4">
      <p className="font-pixel text-[.55rem] text-muted-foreground">
        Continuar?
      </p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        {profile ? (
          <CoachAvatar
            avatar={profile.avatar}
            size={64}
            label={`Avatar do treinador ${career.coach}`}
          />
        ) : (
          <ClubEmblem
            name={career.clubName ?? career.coach}
            size={56}
            decorative
          />
        )}
        <div className="min-w-0">
          <h2
            id="ultima-carreira"
            className="truncate font-pixel text-xs sm:text-sm"
          >
            {title}
          </h2>
          <p className="truncate text-sm">
            {career.coach}
            {profile && (
              <>
                {' · '}
                <strong>{personalityLabel(profile.personality)}</strong>
              </>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {career.clubName ?? 'Clube a escolher'}
            {career.season ? ` · Temporada ${career.season}` : ''}
          </p>
        </div>
      </div>
      {onContinue && (
        <Button
          className="min-h-11"
          onClick={() => {
            play('confirm');
            onContinue();
          }}
        >
          <Play data-icon="inline-start" weight="fill" />
          Continuar<span className="sr-only"> {title}</span>
        </Button>
      )}
    </section>
  );
}

function Counters({ stats }: { stats: PublicStats }) {
  const items = [
    [stats.coaches === 1 ? 'treinador' : 'treinadores', stats.coaches],
    [stats.clubs === 1 ? 'clube' : 'clubes', stats.clubs],
    [stats.athletes === 1 ? 'atleta' : 'atletas', stats.athletes],
  ] as const;
  return (
    <section aria-labelledby="contadores-titulo" className="panel-board p-4">
      <h2
        id="contadores-titulo"
        className="mb-3 flex items-center gap-2 font-pixel text-[.6rem] text-chalk"
      >
        <PixelTrophy size={14} />
        No gramado agora
      </h2>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col items-center border-2 border-wood-deep px-1 py-3"
          >
            <dt className="order-2 mt-1 font-pixel text-[.5rem] text-chalk/80">
              {label}
            </dt>
            <dd className="led order-1 text-lg sm:text-2xl">
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

/** Carregar Carreira: save slots, open or delete, plan limit. */
export function LoadCareerScreen({
  load,
  remove,
  onOpen,
  onNewCareer,
  onBack,
  notice = '',
  error = '',
  onSignOut,
  onUnlock,
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
  /** A locked career (license refunded) asks for the license. */
  onUnlock?: ((career: CareerSummary) => void) | undefined;
}) {
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const { play } = useSound();

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
      play('whistle');
      await refresh();
    } catch (caught) {
      play('error');
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
      <ScreenTransition id="carregar" className="mx-auto mt-6 max-w-3xl">
        <section aria-labelledby="carregar-titulo">
          <Button variant="ghost" className="-ml-2 min-h-11" onClick={onBack}>
            <ArrowLeft data-icon="inline-start" />
            Voltar ao início
          </Button>
          <div className="panel-board mt-2 flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-end">
            <div>
              <p className="led text-[.55rem] tracking-[.3em]">Vestiário</p>
              <h1
                id="carregar-titulo"
                className="mt-1 font-pixel text-base leading-relaxed sm:text-2xl"
              >
                Carregar carreira
              </h1>
            </div>
            <Button variant="play" className="min-h-11" onClick={onNewCareer}>
              <Plus data-icon="inline-start" weight="bold" />
              Nova carreira
            </Button>
          </div>

          <PlanNotice used={careers.length} limit={limit} notice={notice} />
          {error && (
            <p
              role="alert"
              className="mt-3 border-2 border-destructive bg-chalk px-3 py-2 text-sm text-ink"
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
              className="mt-6 flex items-center gap-2 font-pixel text-[.6rem]"
            >
              <CircleNotch className="size-5 animate-spin text-bulb" />
              Buscando suas carreiras…
            </p>
          ) : state.status === 'error' ? (
            <div role="alert" className="panel mt-6 p-5">
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
            <div className="panel mt-6 p-8 text-center">
              <PixelBall size={32} className="mx-auto px-bounce" />
              <p className="mt-3 font-pixel text-xs sm:text-sm">
                Nenhuma carreira salva
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha um clube e comece sua primeira temporada.
              </p>
              <Button
                variant="play"
                className="mt-5 min-h-11"
                onClick={onNewCareer}
              >
                <Plus data-icon="inline-start" weight="bold" />
                Começar nova carreira
              </Button>
            </div>
          ) : (
            <ul
              aria-label="Suas carreiras"
              className="mt-6 flex flex-col gap-4"
            >
              {careers.map((career, index) => (
                <CareerRow
                  key={career.id}
                  slot={index + 1}
                  career={career}
                  confirming={confirming === career.id}
                  deleting={deleting && confirming === career.id}
                  onOpen={() => {
                    play('confirm');
                    onOpen(career);
                  }}
                  onUnlock={() => {
                    play('click');
                    onUnlock?.(career);
                  }}
                  onAskDelete={() => setConfirming(career.id)}
                  onCancelDelete={() => setConfirming(null)}
                  onConfirmDelete={() => void confirmDelete(career)}
                />
              ))}
            </ul>
          )}
        </section>
      </ScreenTransition>
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
        'panel mt-5 px-4 py-3 text-sm',
        notice && 'outline outline-4 outline-bulb',
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
          <strong className="font-pixel text-[.6rem] text-ink">
            {used} de {limit} {limit === 1 ? 'carreira' : 'carreiras'} ·{' '}
          </strong>
        )}
        Plano grátis: {FREE_CAREER_LIMIT} carreira. Licença única: até{' '}
        {LICENSE_CAREER_LIMIT}.
      </p>
    </div>
  );
}

/** One save slot. */
function CareerRow({
  slot,
  career,
  confirming,
  deleting,
  onOpen,
  onUnlock,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  slot: number;
  career: CareerSummary;
  confirming: boolean;
  deleting: boolean;
  onOpen(): void;
  onUnlock(): void;
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

  const locked = career.locked === true;

  return (
    <li
      className={cn('panel overflow-hidden', locked && 'bg-secondary')}
      data-locked={locked ? 'true' : undefined}
    >
      <div className="flex items-center justify-between border-b-2 border-ink bg-board px-3 py-1 font-pixel text-[.55rem] text-bulb">
        <span className="flex items-center gap-2">
          Save {String(slot).padStart(2, '0')}
          {locked && (
            <span className="inline-flex items-center gap-1 bg-bulb px-1.5 py-0.5 text-bulb-foreground">
              <Lock weight="fill" aria-hidden="true" />
              Bloqueada
            </span>
          )}
        </span>
        {career.updatedAt && <span>{formatUpdated(career.updatedAt)}</span>}
      </div>
      <div className="grid grid-cols-[auto_1fr] items-center gap-4 p-4 sm:grid-cols-[auto_1fr_auto]">
        <span className={cn('relative', locked && 'opacity-60 grayscale')}>
          <ClubEmblem
            name={career.clubName ?? career.coach}
            size={56}
            decorative
          />
          {career.coachProfile && (
            <CoachAvatar
              avatar={career.coachProfile.avatar}
              size={28}
              className="absolute -bottom-1 -right-2"
            />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-pixel text-xs leading-relaxed sm:text-sm">
            {title}
          </h2>
          <p className="truncate text-sm font-medium">
            {career.clubName ?? 'Clube a escolher'} · {career.coach}
            {career.coachProfile &&
              ` · ${personalityLabel(career.coachProfile.personality)}`}
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
          {locked && (
            <p className="mt-1 flex items-start gap-1.5 text-xs font-medium text-ink">
              <Lock
                className="mt-0.5 shrink-0 text-primary"
                weight="fill"
                aria-hidden="true"
              />
              Salva, mas bloqueada: o plano grátis joga só a carreira mais
              antiga. A licença libera de novo.
            </p>
          )}
        </div>
        <div className="col-span-2 grid grid-cols-[1fr_auto] gap-3 sm:col-span-1">
          {locked ? (
            <Button
              variant="play"
              className="min-h-11 whitespace-normal"
              onClick={onUnlock}
              aria-label={`Desbloquear ${title} com a licença`}
              disabled={confirming}
            >
              <Lock data-icon="inline-start" weight="fill" />
              Desbloquear
            </Button>
          ) : (
            <Button
              className="min-h-11"
              onClick={onOpen}
              aria-label={`Abrir ${title}`}
              disabled={confirming}
            >
              <Play data-icon="inline-start" weight="fill" />
              Abrir
            </Button>
          )}
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
          className="border-t-4 border-destructive bg-popover p-4"
          onKeyDown={(event) => {
            if (event.key === 'Escape') onCancelDelete();
          }}
        >
          <p id={dialogTitle} className="font-pixel text-xs">
            Excluir carreira?
          </p>
          <p id={dialogText} className="mt-1 text-sm">
            {title} será apagada para sempre, com elenco, títulos e histórico.
            Essa ação não pode ser desfeita.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
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
              className="min-h-11"
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
