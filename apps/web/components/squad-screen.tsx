'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import {
  ArrowsClockwise,
  CheckCircle,
  Crosshair,
  FloppyDisk,
  MagnifyingGlass,
  Sparkle,
  Star,
  Tag,
  Trash,
  UsersThree,
} from '@phosphor-icons/react';
import { AthleteCard } from '@/components/athlete-card';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { PitchArt } from '@/components/retro/pitch-art';
import { PixelStar, PixelWhistle } from '@/components/retro/sprites';
import { useTicker } from '@/components/retro/ticker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type {
  AutoPickStrategy,
  CareerApiPort,
  CareerView,
  PlayerView,
  TacticsView,
} from '@/lib/career-api';
import {
  applySavedLineup,
  AUTO_PICK_MODES,
  autoPickSummary,
  boardRoles,
  boardStrength,
  buildBoard,
  chemistryLabel,
  FORMATION_LAYOUT,
  formatBrl,
  groupByPosition,
  lineupInput,
  loadSavedLineups,
  locate,
  MAX_BENCH,
  MAX_SAVED_LINEUPS,
  placePlayer,
  POSITION_NAME,
  positionFit,
  reformBoard,
  SERVER_FORMATIONS,
  storeSavedLineups,
  TACTIC_LABEL,
  TACTIC_PRESETS,
  upsertSavedLineup,
  validateBoard,
  type BoardTarget,
  type LineupBoard,
  type ListingInput,
  type MarketListingView,
  type SavedLineup,
  type ServerFormation,
} from '@/lib/management-model';
import type { ContractView } from '@/lib/phase4-model';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

export type SquadTab = 'board' | 'tactics' | 'list';

interface SquadScreenProps {
  career: CareerView;
  api: CareerApiPort;
  onCareerChange(value: CareerView): void;
  reportError(message: string): void;
  initialTab?: SquadTab;
}

const DRAG_THRESHOLD = 6;

const targetKey = (target: BoardTarget) =>
  target.kind === 'slot' ? `slot:${String(target.index)}` : target.kind;

function parseTarget(value: string | undefined): BoardTarget | null {
  if (!value) return null;
  if (value === 'bench' || value === 'reserves') return { kind: value };
  const [kind, index] = value.split(':');
  return kind === 'slot' && index !== undefined
    ? { kind: 'slot', index: Number(index) }
    : null;
}

const lastName = (name: string) => name.split(' ').at(-1) ?? name;

const scrollTo = (element: HTMLElement | null) =>
  element?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });

const roleLabel = {
  starter: 'Titular',
  bench: 'Banco',
  reserve: 'Reserva',
} as const;

/**
 * Elenco (docs/09). Top: the selected athlete's sticker with everything the
 * manager can do with them. Middle: the chalk pitch (responsive SVG, never
 * taller than ~60% of the phone screen) with bench and reserves, or the
 * tactics board. Bottom: the whole squad grouped by position, as a picker
 * that sends the tapped athlete up to the card. Players move by dragging
 * (pointer events, so touch works) or by selecting one and then its
 * destination; both go through the same `placePlayer`, and the board is
 * validated before `SetLineup` is sent.
 */
export function SquadScreen({
  career,
  api,
  onCareerChange,
  reportError,
  initialTab = 'board',
}: SquadScreenProps) {
  const { play } = useSound();
  const ticker = useTicker();
  const players = career.players;
  const byId = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const [board, setBoard] = useState<LineupBoard>(() =>
    buildBoard(players, career.formation),
  );
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string>(players[0]?.id ?? '');
  const [captainId, setCaptainId] = useState<string>(
    () => lineupInput(buildBoard(players, career.formation), players).captainId,
  );
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [pickSummary, setPickSummary] = useState('');
  const [tab, setTab] = useState<'board' | 'tactics'>(
    initialTab === 'tactics' ? 'tactics' : 'board',
  );
  const [tactics, setTactics] = useState<TacticsView>(career.tactics);
  const [listings, setListings] = useState<readonly MarketListingView[]>([]);
  const careerKey = career.careerId ?? career.club;
  // Read once per mount: the shell remounts the screen per career.
  const [saved, setSaved] = useState<SavedLineup[]>(() =>
    loadSavedLineups(careerKey),
  );
  const [lineupName, setLineupName] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLElement>(null);

  // Server truth wins whenever the career changes under us (auto-pick, save).
  const syncKey = `${career.formation}|${players
    .map((p) => `${p.id}:${p.role}:${p.lineupPosition ?? ''}`)
    .join(',')}`;
  const lastSync = useRef(syncKey);
  useEffect(() => {
    if (lastSync.current === syncKey) return;
    lastSync.current = syncKey;
    setBoard(buildBoard(players, career.formation));
    setDirty(false);
  }, [syncKey, players, career.formation]);

  // Who is already announced on the market (same source as Mercado).
  useEffect(() => {
    let active = true;
    api
      .getMarket({})
      .then((market) => {
        if (active) setListings(market.listings);
      })
      .catch(() => {
        // Market unavailable: the card just hides the "anunciado" state.
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (initialTab === 'list') scrollTo(listRef.current);
  }, [initialTab]);

  const problems = useMemo(
    () => validateBoard(board, players),
    [board, players],
  );
  const strength = boardStrength(board, players);
  const layout = FORMATION_LAYOUT[board.formation];

  const announce = useCallback(
    (text: string) => {
      setAnnouncement(text);
      ticker.announce(text);
    },
    [ticker],
  );

  const place = useCallback(
    (playerId: string, target: BoardTarget) => {
      const mover = byId.get(playerId);
      if (!mover) return;
      const before = locate(board, playerId);
      if (targetKey(before) === targetKey(target) && target.kind !== 'slot') {
        setSelectedId(null);
        return;
      }
      const occupant =
        target.kind === 'slot' ? (board.slots[target.index] ?? null) : null;
      const next = placePlayer(board, playerId, target);
      setBoard(next);
      setDirty(true);
      setSelectedId(null);
      setFocusId(playerId);
      play('click');
      const where =
        target.kind === 'slot'
          ? `titular como ${POSITION_NAME[layout[target.index]!.position].toLowerCase()}`
          : target.kind === 'bench'
            ? 'no banco'
            : 'nas reservas';
      const swapped =
        occupant && occupant !== playerId
          ? ` ${lastName(byId.get(occupant)?.name ?? '')} ${
              before.kind === 'slot'
                ? `assume a vaga de ${POSITION_NAME[layout[before.index]!.position].toLowerCase()}`
                : before.kind === 'bench'
                  ? 'vai para o banco'
                  : 'vai para as reservas'
            }.`
          : '';
      announce(`${mover.name} agora ${where}.${swapped}`);
    },
    [announce, board, byId, layout, play],
  );

  // Selection path (tap/keyboard): pick a player, then pick a destination.
  const onPlayerActivate = (playerId: string) => {
    if (selectedId && selectedId !== playerId) {
      place(selectedId, locate(board, playerId));
      return;
    }
    if (selectedId === playerId) {
      setSelectedId(null);
      announce('Seleção cancelada.');
      return;
    }
    const player = byId.get(playerId);
    setSelectedId(playerId);
    setFocusId(playerId);
    play('click');
    announce(
      `${player?.name ?? 'Jogador'} selecionado. Escolha a posição, o banco ou as reservas.`,
    );
  };

  const onTargetActivate = (target: BoardTarget) => {
    if (!selectedId) {
      if (target.kind === 'slot') {
        const id = board.slots[target.index];
        if (id) onPlayerActivate(id);
      }
      return;
    }
    place(selectedId, target);
  };

  // Drag path: pointer events with a small threshold so taps still select.
  const drag = useRef<{
    playerId: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState<{
    playerId: string;
    x: number;
    y: number;
    over: string | null;
  } | null>(null);

  const onPointerDown = (event: ReactPointerEvent, playerId: string) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    drag.current = {
      playerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    current.moved = true;
    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-drop]');
    setDragging({
      playerId: current.playerId,
      x: event.clientX,
      y: event.clientY,
      over: under?.dataset['drop'] ?? null,
    });
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!current.moved) return;
    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-drop]');
    const target = parseTarget(under?.dataset['drop']);
    setDragging(null);
    if (target) place(current.playerId, target);
    else play('error');
  };
  const cancelDrag = () => {
    drag.current = null;
    setDragging(null);
  };
  const onClickPlayer = (playerId: string) => {
    // A completed drag already placed the player; skip the synthetic click.
    if (dragging) return;
    onPlayerActivate(playerId);
  };

  const run = async (
    label: string,
    action: () => Promise<string | void>,
  ): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      reportError('');
      const result = await action();
      play('confirm');
      announce(result ?? label);
      return true;
    } catch (caught) {
      play('error');
      const message =
        caught instanceof Error ? caught.message : 'Tente novamente.';
      reportError(message);
      ticker.announce(message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveLineup = () =>
    run('Escalação enviada ao vestiário.', async () => {
      if (problems.length) throw new Error(problems[0]);
      onCareerChange(
        await api.setLineup(lineupInput(board, players, captainId)),
      );
      setDirty(false);
    });

  const autoPick = (strategy: AutoPickStrategy) =>
    run('Escalação automática aplicada.', async () => {
      const before = board.slots.filter((id): id is string => Boolean(id));
      const view = await api.autoPick(strategy);
      onCareerChange(view);
      const after = view.players.filter((player) => player.role === 'starter');
      const entering = after.filter((player) => !before.includes(player.id));
      const leaving = before
        .filter((id) => !after.some((player) => player.id === id))
        .flatMap((id) => byId.get(id) ?? []);
      // The board follows the server even when the roles did not change.
      setBoard(buildBoard(view.players, view.formation));
      setDirty(false);
      const mode = AUTO_PICK_MODES.find((item) => item.id === strategy);
      const summary = autoPickSummary(entering, leaving);
      setPickSummary(`${mode?.label ?? 'Automática'} · ${summary}`);
      return summary;
    });

  const saveTactics = () =>
    run('Tática salva.', async () => {
      onCareerChange(
        await api.setTactics({ formation: board.formation, tactics }),
      );
    });

  const changeFormation = (formation: ServerFormation) => {
    setBoard((current) => reformBoard(current, players, formation));
    setDirty(true);
    play('click');
  };

  const applyPreset = (presetId: string) => {
    const preset = TACTIC_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setTactics(preset.tactics);
    changeFormation(preset.formation);
    announce(`Preset ${preset.name} aplicado. Salve a tática para valer.`);
  };

  const persist = (lineups: SavedLineup[]) => {
    setSaved(lineups);
    storeSavedLineups(careerKey, lineups);
  };
  const saveNamed = () => {
    const name = lineupName.trim();
    if (!name) {
      reportError('Dê um nome à escalação antes de salvar.');
      play('error');
      return;
    }
    try {
      persist(
        upsertSavedLineup(saved, {
          name,
          board,
          tactics,
          savedAt: new Date().toISOString(),
        }),
      );
      setLineupName('');
      play('coin');
      announce(`Escalação "${name}" guardada neste aparelho.`);
    } catch (caught) {
      play('error');
      reportError(caught instanceof Error ? caught.message : 'Não salvou.');
    }
  };
  const applyNamed = (lineup: SavedLineup) => {
    setBoard(applySavedLineup(lineup, players));
    setTactics(lineup.tactics);
    setDirty(true);
    play('click');
    announce(`Escalação "${lineup.name}" carregada. Confira e envie.`);
  };
  const removeNamed = (name: string) =>
    persist(saved.filter((item) => item.name !== name));

  // --- actions of the selected athlete ------------------------------------
  const focusPlayer = (id: string) => {
    setFocusId(id);
    play('click');
    scrollTo(cardRef.current);
  };
  // Best slot for a player: free natural position first, then secondary.
  const bestSlot = (player: PlayerView) => {
    for (const fit of [2, 1] as const) {
      const index = layout.findIndex(
        (slot, at) =>
          positionFit(player, slot.position) === fit && !board.slots[at],
      );
      if (index >= 0) return index;
    }
    for (const fit of [2, 1, 0] as const) {
      const index = layout.findIndex(
        (slot) => positionFit(player, slot.position) === fit,
      );
      if (index >= 0) return index;
    }
    return 0;
  };
  const moveOnPitch = (player: PlayerView) => {
    setTab('board');
    setSelectedId(player.id);
    play('click');
    announce(
      `${player.name} selecionado. Toque na posição do campo, no banco ou nas reservas.`,
    );
    scrollTo(pitchRef.current);
  };
  const makeCaptain = (player: PlayerView) => {
    setCaptainId(player.id);
    setDirty(true);
    play('coin');
    announce(`${player.name} é o novo capitão. Salve a escalação para valer.`);
  };
  const listPlayer = (input: ListingInput) =>
    run('Atleta anunciado no mercado.', async () => {
      const market = await api.listForTransfer(input);
      setListings(market.listings);
    });
  const withdrawListing = (playerId: string) =>
    run('Anúncio retirado.', async () => {
      const market = await api.withdrawListing(playerId);
      setListings(market.listings);
    });
  const renewContract = (playerId: string, months: 6 | 12 | 24) =>
    run(`Contrato renovado por ${String(months)} meses.`, async () => {
      onCareerChange(await api.renewContract(playerId, months));
    });

  const roles = boardRoles(board);
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const focused = byId.get(focusId) ?? players[0];
  const chemistry = career.chemistry;
  const effectiveCaptain = lineupInput(board, players, captainId).captainId;

  const chip = (playerId: string, zone: 'bench' | 'reserves') => {
    const player = byId.get(playerId);
    if (!player) return null;
    const unavailable = player.injuryRounds > 0 || player.suspended;
    return (
      <li key={playerId}>
        <button
          type="button"
          aria-pressed={selectedId === playerId}
          aria-label={`${player.name}, ${player.primaryPosition}, força ${String(player.strength)}, ${zone === 'bench' ? 'no banco' : 'nas reservas'}${unavailable ? ', indisponível' : ''}`}
          data-player={playerId}
          className={cn(
            'sticker grid w-[4.2rem] touch-none select-none place-items-center gap-1 px-1 pb-1 pt-1.5 text-center',
            selectedId === playerId && 'outline outline-4 outline-bulb',
            dragging?.playerId === playerId && 'opacity-40',
            unavailable && 'saturate-50',
          )}
          onPointerDown={(event) => onPointerDown(event, playerId)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={cancelDrag}
          onClick={() => onClickPlayer(playerId)}
        >
          <PixelAvatar seed={`atleta-${playerId}`} size={28} />
          <span className="w-full truncate text-[.6rem] font-bold leading-tight">
            {lastName(player.name)}
          </span>
          <span className="flex items-center gap-1 font-pixel text-[.45rem]">
            <span className="bg-ink px-0.5 text-chalk">
              {player.primaryPosition}
            </span>
            <span className="led bg-board px-0.5">{player.strength}</span>
          </span>
          {unavailable && (
            <span className="font-pixel text-[.4rem] uppercase text-destructive">
              {player.suspended ? 'Susp.' : 'Les.'}
            </span>
          )}
        </button>
      </li>
    );
  };

  const zone = (
    kind: 'bench' | 'reserves',
    title: string,
    ids: readonly string[],
    hint: string,
  ) => (
    <section
      aria-labelledby={`zona-${kind}`}
      data-drop={kind}
      className={cn(
        'panel-wood p-2 transition-[outline]',
        dragging?.over === kind && 'outline outline-4 outline-bulb',
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <h3
          id={`zona-${kind}`}
          className="font-pixel text-[.55rem] uppercase text-chalk"
        >
          {title}{' '}
          <span className="led">
            {ids.length}
            {kind === 'bench' ? `/${String(MAX_BENCH)}` : ''}
          </span>
        </h3>
        <button
          type="button"
          className="btn-px btn-chalk min-h-10 px-2 py-1 text-[.5rem] disabled:opacity-60"
          disabled={!selectedId}
          onClick={() => onTargetActivate({ kind })}
          aria-label={
            selected
              ? `Mandar ${selected.name} para ${kind === 'bench' ? 'o banco' : 'as reservas'}`
              : `Escolha um jogador para mandar para ${kind === 'bench' ? 'o banco' : 'as reservas'}`
          }
        >
          {kind === 'bench' ? 'Para o banco' : 'Para reservas'}
        </button>
      </div>
      <ul
        role="list"
        aria-label={title}
        className="mt-2 flex min-h-[5rem] flex-wrap gap-1 pb-1"
      >
        {ids.length === 0 && (
          <li className="self-center px-2 text-[.65rem] text-chalk/80">
            {hint}
          </li>
        )}
        {ids.map((id) => chip(id, kind))}
      </ul>
    </section>
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <header className="panel-board grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="font-pixel text-xs uppercase text-chalk">
            Vestiário · <span className="led">{board.formation}</span>
          </h2>
          <p className="font-pixel text-[.55rem] uppercase text-chalk/80">
            Força do time <span className="led text-sm">{strength}</span>
          </p>
          {chemistry && (
            <div
              className="flex items-center gap-2"
              aria-label={`Entrosamento ${String(chemistry.value)} de 100, ${chemistryLabel(chemistry.value)}, bônus de ${chemistry.bonusPercent.toFixed(1)}% na força`}
            >
              <span className="font-pixel text-[.55rem] uppercase text-chalk/80">
                Entrosamento
              </span>
              <span className="w-20">
                <Progress
                  value={chemistry.value}
                  tone={chemistry.value >= 60 ? 'bulb' : 'red'}
                  aria-hidden="true"
                />
              </span>
              <span className="led text-sm">{chemistry.value}</span>
              <span className="text-[.6rem] text-chalk/80">
                +{chemistry.bonusPercent.toFixed(1)}%
                {chemistry.startersChanged > 0 &&
                  ` · ${String(chemistry.startersChanged)} troca(s) desde o último jogo`}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="play"
          size="sm"
          disabled={busy || !dirty}
          onClick={() => void saveLineup()}
          aria-describedby={problems.length ? 'problemas-escalacao' : undefined}
        >
          <CheckCircle data-icon="inline-start" />
          Salvar escalação
        </Button>
      </header>

      {problems.length > 0 && (
        <ul
          id="problemas-escalacao"
          aria-label="Pendências da escalação"
          className="panel flex flex-col gap-1 p-2 text-xs"
        >
          {problems.map((problem) => (
            <li key={problem} className="flex items-center gap-2">
              <PixelWhistle size={12} />
              {problem}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        {/* Top: the selected athlete and what can be done with them. */}
        <div
          ref={cardRef}
          className="scroll-mt-20 lg:col-start-1 lg:row-start-1"
        >
          {focused && (
            <FocusCard
              player={focused}
              career={career}
              role={roles.get(focused.id) ?? 'reserve'}
              isCaptain={effectiveCaptain === focused.id}
              listing={listings.find((item) => item.playerId === focused.id)}
              contract={career.world.contracts.find(
                (item) => item.playerId === focused.id,
              )}
              busy={busy}
              onRole={(target) =>
                place(
                  focused.id,
                  target === 'starter'
                    ? { kind: 'slot', index: bestSlot(focused) }
                    : target === 'bench'
                      ? { kind: 'bench' }
                      : { kind: 'reserves' },
                )
              }
              onMoveOnPitch={() => moveOnPitch(focused)}
              onCaptain={() => makeCaptain(focused)}
              onList={listPlayer}
              onWithdraw={() => void withdrawListing(focused.id)}
              onRenew={(months) => void renewContract(focused.id, months)}
            />
          )}
        </div>

        {/* Middle: pitch or tactics board. */}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as 'board' | 'tactics')}
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="board">Campo</TabsTrigger>
            <TabsTrigger value="tactics">Táticas</TabsTrigger>
          </TabsList>

          <TabsContent value="board">
            <div className="flex flex-col gap-3">
              <section
                aria-label="Escalação automática"
                className="panel grid gap-2 p-2"
              >
                <div
                  role="group"
                  aria-label="Modos de escalação automática"
                  className="grid gap-1 sm:grid-cols-3"
                >
                  {AUTO_PICK_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void autoPick(mode.id)}
                      className="btn-px btn-chalk flex min-h-10 items-center gap-2 px-2 py-1.5 text-left disabled:opacity-60 sm:grid sm:min-h-14 sm:content-center sm:gap-0.5 sm:px-1 sm:text-center"
                    >
                      <span className="flex min-w-[5.5rem] items-center gap-1 text-[.55rem] leading-tight sm:min-w-0 sm:justify-center sm:text-[.6rem]">
                        {mode.id === 'best' ? (
                          <Sparkle size={12} className="hidden sm:inline" />
                        ) : mode.id === 'rest' ? (
                          <ArrowsClockwise
                            size={12}
                            className="hidden sm:inline"
                          />
                        ) : (
                          <UsersThree size={12} className="hidden sm:inline" />
                        )}
                        {mode.label}
                      </span>
                      <span className="font-sans text-[.6rem] normal-case leading-tight text-muted-foreground">
                        {mode.description}
                      </span>
                    </button>
                  ))}
                </div>
                {pickSummary && (
                  <p
                    role="status"
                    data-testid="resumo-automatica"
                    className="flex items-start gap-1.5 bg-muted px-2 py-1 text-xs"
                  >
                    <Sparkle size={12} className="mt-0.5 shrink-0" />
                    {pickSummary}
                  </p>
                )}
              </section>

              <p className="px-1 text-xs text-chalk">
                {selected
                  ? `${selected.name} selecionado: toque na posição, no banco ou nas reservas.`
                  : 'Arraste um jogador ou toque nele e depois no destino. Pelo teclado: Enter seleciona e Enter no destino confirma.'}
              </p>
              <div
                ref={pitchRef}
                data-testid="campo"
                className="pitch-frame @container panel-chalk relative mx-auto aspect-[68/105] w-full max-w-[calc(60svh*0.6476)] scroll-mt-20 select-none overflow-hidden lg:max-w-[calc(78svh*0.6476)]"
                role="group"
                aria-label={`Campo tático ${board.formation}`}
                onKeyDown={(event: KeyboardEvent) => {
                  if (event.key === 'Escape' && selectedId) {
                    setSelectedId(null);
                    announce('Seleção cancelada.');
                  }
                }}
              >
                <PitchArt className="absolute inset-0" />
                {layout.map((slot, index) => {
                  const id = board.slots[index];
                  const player = id ? byId.get(id) : undefined;
                  const fit = player ? positionFit(player, slot.position) : 0;
                  const key = targetKey({ kind: 'slot', index });
                  const unavailable =
                    player && (player.injuryRounds > 0 || player.suspended);
                  const isCaptain = player && effectiveCaptain === player.id;
                  return (
                    <button
                      key={key}
                      type="button"
                      data-drop={key}
                      data-slot-position={slot.position}
                      aria-pressed={Boolean(player && selectedId === player.id)}
                      aria-label={
                        player
                          ? `${POSITION_NAME[slot.position]}: ${player.name}, força ${String(player.strength)}${fit === 2 ? '' : fit === 1 ? ', posição secundária' : ', fora de posição'}${isCaptain ? ', capitão' : ''}${unavailable ? ', indisponível' : ''}`
                          : `${POSITION_NAME[slot.position]}: vaga livre`
                      }
                      className={cn(
                        'absolute flex w-[clamp(3rem,17cqw,4.6rem)] -translate-x-1/2 -translate-y-1/2 touch-none flex-col items-center gap-px text-center',
                        dragging?.over === key && 'scale-110',
                      )}
                      style={{
                        left: `${String(slot.x)}%`,
                        top: `${String(slot.y)}%`,
                      }}
                      onPointerDown={(event) =>
                        player && onPointerDown(event, player.id)
                      }
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={cancelDrag}
                      onClick={() => {
                        if (dragging) return;
                        if (selectedId)
                          onTargetActivate({ kind: 'slot', index });
                        else if (player) onPlayerActivate(player.id);
                      }}
                    >
                      <span
                        className={cn(
                          'relative grid size-[clamp(1.75rem,10cqw,2.75rem)] place-items-center bg-chalk px-border [&>img]:!size-full',
                          player &&
                            selectedId === player.id &&
                            'outline outline-4 outline-bulb',
                          !player &&
                            'bg-chalk/30 outline-dashed outline-2 outline-chalk',
                          dragging?.playerId === player?.id && 'opacity-40',
                          selectedId &&
                            (!player || selectedId !== player.id) &&
                            'animate-pulse',
                        )}
                      >
                        {player ? (
                          <PixelAvatar seed={`atleta-${player.id}`} size={44} />
                        ) : (
                          <span className="font-pixel text-[.5rem] text-chalk">
                            {slot.position}
                          </span>
                        )}
                        {player && (
                          <span
                            aria-hidden="true"
                            className={cn(
                              'absolute -right-1 -top-1 px-0.5 font-pixel text-[.4rem]',
                              fit === 2
                                ? 'bg-primary text-chalk'
                                : fit === 1
                                  ? 'bg-bulb text-ink'
                                  : 'bg-destructive text-chalk',
                            )}
                          >
                            {slot.position}
                          </span>
                        )}
                        {isCaptain && (
                          <span
                            aria-hidden="true"
                            className="absolute -left-1 -top-1 bg-bulb px-0.5 font-pixel text-[.4rem] text-ink"
                          >
                            C
                          </span>
                        )}
                        {unavailable && (
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-1 -left-1 bg-destructive px-0.5 font-pixel text-[.4rem] text-chalk"
                          >
                            !
                          </span>
                        )}
                      </span>
                      <span className="w-full truncate bg-ink/85 px-0.5 text-[clamp(.55rem,2.6cqw,.68rem)] font-bold leading-tight text-chalk">
                        {player ? lastName(player.name) : 'Vaga'}
                      </span>
                      {player && (
                        <span className="led text-[clamp(.5rem,2.4cqw,.6rem)] leading-none">
                          {player.strength}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div
                role="group"
                aria-label="Formação"
                className="panel flex items-center gap-2 p-2"
              >
                <span className="font-pixel text-[.55rem] uppercase">
                  Formação
                </span>
                <ToggleGroup
                  type="single"
                  value={board.formation}
                  onValueChange={(value) =>
                    value && changeFormation(value as ServerFormation)
                  }
                  className="grid flex-1 grid-cols-3"
                >
                  {SERVER_FORMATIONS.map((formation) => (
                    <ToggleGroupItem
                      key={formation}
                      value={formation}
                      className="min-h-10"
                    >
                      {formation}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              {zone(
                'bench',
                'Banco',
                board.bench,
                'Banco vazio: arraste alguém para cá.',
              )}
              {zone(
                'reserves',
                'Reservas',
                board.reserves,
                'Todo mundo relacionado.',
              )}
              <SavedLineups
                saved={saved}
                name={lineupName}
                onName={setLineupName}
                onSave={saveNamed}
                onApply={applyNamed}
                onRemove={removeNamed}
              />
            </div>
          </TabsContent>

          <TabsContent value="tactics">
            <TacticsPanel
              formation={board.formation}
              tactics={tactics}
              busy={busy}
              onFormation={changeFormation}
              onChange={setTactics}
              onPreset={applyPreset}
              onSave={() => void saveTactics()}
            />
          </TabsContent>
        </Tabs>

        {/* Bottom: the whole squad as a picker. */}
        <SquadList
          ref={listRef}
          players={players}
          roles={roles}
          captainId={effectiveCaptain}
          focusId={focused?.id ?? ''}
          onFocus={focusPlayer}
          className="lg:col-start-1 lg:row-start-2"
        />
      </div>

      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 px-border bg-chalk p-1 shadow-lg"
          style={{ left: dragging.x, top: dragging.y }}
        >
          <PixelAvatar seed={`atleta-${dragging.playerId}`} size={40} />
        </div>
      )}
    </div>
  );
}

// --- selected athlete -----------------------------------------------------
function FocusCard({
  player,
  career,
  role,
  isCaptain,
  listing,
  contract,
  busy,
  onRole,
  onMoveOnPitch,
  onCaptain,
  onList,
  onWithdraw,
  onRenew,
}: {
  player: PlayerView;
  career: CareerView;
  role: PlayerView['role'];
  isCaptain: boolean;
  listing: MarketListingView | undefined;
  contract: ContractView | undefined;
  busy: boolean;
  onRole(target: PlayerView['role']): void;
  onMoveOnPitch(): void;
  onCaptain(): void;
  onList(input: ListingInput): Promise<boolean>;
  onWithdraw(): void;
  onRenew(months: 6 | 12 | 24): void;
}) {
  const [listingOpen, setListingOpen] = useState(false);
  const unavailable = player.injuryRounds > 0 || player.suspended;
  return (
    <section
      aria-label={`Atleta selecionado: ${player.name}`}
      data-testid="card-selecionado"
      className="flex flex-col gap-2"
    >
      <AthleteCard player={player} club={{ name: career.club }} />
      <div className="panel grid gap-2 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={role === 'starter' ? 'bulb' : 'outline'}>
            {roleLabel[role]}
          </Badge>
          {isCaptain && (
            <Badge variant="secondary">
              <Star size={10} weight="fill" />
              Capitão
            </Badge>
          )}
          {listing && (
            <Badge variant="outline">
              <Tag size={10} />
              {listing.mode === 'sale'
                ? `À venda · ${formatBrl(listing.askingPrice)}`
                : `Empréstimo · ${String(listing.durationMonths)} meses`}
            </Badge>
          )}
          {contract && (
            <Badge
              variant={contract.status === 'expiring' ? 'bulb' : 'outline'}
            >
              Contrato · {contract.monthsRemaining} meses
            </Badge>
          )}
        </div>

        <div
          role="group"
          aria-label={`Escalar ${player.name}`}
          className="grid grid-cols-3 gap-1"
        >
          <Button
            size="sm"
            variant="secondary"
            disabled={role === 'starter' || unavailable}
            onClick={() => onRole('starter')}
          >
            Titular
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={role === 'bench'}
            onClick={() => onRole('bench')}
          >
            Banco
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={role === 'reserve'}
            onClick={() => onRole('reserve')}
          >
            Reserva
          </Button>
        </div>

        <div
          role="group"
          aria-label={`Ações com ${player.name}`}
          className="grid grid-cols-2 gap-1"
        >
          <Button size="sm" variant="outline" onClick={onMoveOnPitch}>
            <Crosshair data-icon="inline-start" />
            {role === 'starter'
              ? 'Trocar de posição'
              : 'Escolher vaga no campo'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={role !== 'starter' || isCaptain}
            onClick={onCaptain}
            aria-label={
              isCaptain
                ? `${player.name} já é o capitão`
                : `Definir ${player.name} como capitão`
            }
          >
            <Star data-icon="inline-start" />
            {isCaptain ? 'Capitão' : 'Definir capitão'}
          </Button>
          {listing ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onWithdraw}
              aria-label={`Retirar anúncio de ${player.name}`}
            >
              <Tag data-icon="inline-start" />
              Retirar anúncio
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              aria-expanded={listingOpen}
              aria-controls={`anuncio-${player.id}`}
              onClick={() => setListingOpen((open) => !open)}
            >
              <Tag data-icon="inline-start" />
              Anunciar no mercado
            </Button>
          )}
          <details className="contents">
            <summary className="btn-px btn-chalk flex min-h-9 cursor-pointer list-none items-center justify-center gap-2 px-2 font-pixel text-[.55rem] uppercase leading-tight [&::-webkit-details-marker]:hidden">
              <MagnifyingGlass size={14} />
              Ver estatísticas
            </summary>
            <div className="col-span-2">
              <PlayerStats player={player} />
            </div>
          </details>
        </div>

        {listingOpen && !listing && (
          <ListingForm
            id={`anuncio-${player.id}`}
            player={player}
            busy={busy}
            onSubmit={async (input) => {
              if (await onList(input)) setListingOpen(false);
            }}
          />
        )}

        {contract && (
          <ContractActions contract={contract} busy={busy} onRenew={onRenew} />
        )}
      </div>
    </section>
  );
}

function PlayerStats({ player }: { player: PlayerView }) {
  return (
    <div className="grid gap-2 bg-muted p-2">
      <dl className="grid grid-cols-3 gap-1 text-center">
        {[
          ['Jogos', String(player.appearances)],
          ['Gols', String(player.goals)],
          ['Nota', player.lastRating?.toFixed(1) ?? '—'],
          ['Amarelos', String(player.yellowCards)],
          ['Vermelhos', String(player.redCards)],
          ['Idade', String(player.age)],
        ].map(([label, value]) => (
          <div key={label} className="bg-card p-1">
            <dt className="font-pixel text-[.45rem] uppercase text-muted-foreground">
              {label}
            </dt>
            <dd className="led bg-board text-base">{value}</dd>
          </div>
        ))}
      </dl>
      {[
        ['Condição', player.condition],
        ['Moral', player.morale],
        ['Ritmo', player.sharpness],
      ].map(([label, value]) => (
        <div key={label}>
          <div className="mb-0.5 flex justify-between">
            <span>{label}</span>
            <strong>{value}%</strong>
          </div>
          <Progress
            value={Number(value)}
            aria-label={`${String(label)}: ${String(value)}%`}
          />
        </div>
      ))}
      <ul className="flex flex-wrap gap-1" aria-label="Olho clínico">
        {Object.entries({
          Consistência: player.scoutingEstimates.consistency,
          Lesões: player.scoutingEstimates.injuryProneness,
          Adaptação: player.scoutingEstimates.adaptation,
          'Jogo grande': player.scoutingEstimates.bigMatches,
        }).map(([label, value]) => (
          <li key={label}>
            <Badge variant="outline">
              <PixelStar size={8} />
              {label}: {value}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Same terms as "Meu elenco" in Mercado: sale with asking price or loan. */
function ListingForm({
  id,
  player,
  busy,
  onSubmit,
}: {
  id: string;
  player: PlayerView;
  busy: boolean;
  onSubmit(input: ListingInput): Promise<void>;
}) {
  const [mode, setMode] = useState<'sale' | 'loan'>('sale');
  const [price, setPrice] = useState('');
  const [months, setMonths] = useState('6');
  const [share, setShare] = useState('50');
  const suggested = player.strength * 180_000;
  return (
    <form
      id={id}
      aria-label={`Anunciar ${player.name}`}
      className="grid gap-2 bg-muted p-2"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(
          mode === 'sale'
            ? {
                playerId: player.id,
                mode,
                askingPrice: Number(price || suggested),
              }
            : {
                playerId: player.id,
                mode,
                durationMonths: Number(months),
                wageSharePercentage: Number(share),
              },
        );
      }}
    >
      <ToggleGroup
        type="single"
        aria-label="Modo do anúncio"
        value={mode}
        onValueChange={(value) => value && setMode(value as 'sale' | 'loan')}
        className="grid grid-cols-2"
      >
        <ToggleGroupItem value="sale" className="min-h-10">
          Vender
        </ToggleGroupItem>
        <ToggleGroupItem value="loan" className="min-h-10">
          Emprestar
        </ToggleGroupItem>
      </ToggleGroup>
      {mode === 'sale' ? (
        <label className="grid gap-1">
          Preço pedido (R$)
          <Input
            type="number"
            min={0}
            step="any"
            value={price}
            placeholder={String(suggested)}
            onChange={(event) => setPrice(event.target.value)}
          />
          <span className="text-muted-foreground">
            Sugestão: {formatBrl(suggested)}
          </span>
        </label>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1">
            Meses
            <Input
              type="number"
              min={1}
              max={12}
              value={months}
              onChange={(event) => setMonths(event.target.value)}
            />
          </label>
          <label className="grid gap-1">
            Salário pago pelo tomador (%)
            <Input
              type="number"
              min={0}
              max={100}
              value={share}
              onChange={(event) => setShare(event.target.value)}
            />
          </label>
        </div>
      )}
      <Button type="submit" size="sm" disabled={busy}>
        <Tag data-icon="inline-start" />
        {mode === 'sale' ? 'Colocar à venda' : 'Oferecer por empréstimo'}
      </Button>
    </form>
  );
}

function ContractActions({
  contract,
  busy,
  onRenew,
}: {
  contract: ContractView;
  busy: boolean;
  onRenew(months: 6 | 12 | 24): void;
}) {
  if (contract.status === 'refused')
    return (
      <p className="text-muted-foreground">
        Recusou renovar: deixa o clube ao fim do vínculo.
      </p>
    );
  return (
    <div
      role="group"
      aria-label={`Contrato de ${contract.playerName}`}
      className="grid gap-1"
    >
      <p className="flex flex-wrap justify-between gap-x-2 text-muted-foreground">
        <span>Salário {formatBrl(contract.salary)}/mês</span>
        <span>Pede {formatBrl(contract.renewalDemand)}/mês para renovar</span>
      </p>
      <div className="grid grid-cols-3 gap-1">
        {([6, 12, 24] as const).map((months) => (
          <Button
            key={months}
            size="sm"
            variant={months === 12 ? 'secondary' : 'outline'}
            disabled={busy}
            onClick={() => onRenew(months)}
            aria-label={`Renovar contrato por ${String(months)} meses`}
          >
            Renovar {months}m
          </Button>
        ))}
      </div>
    </div>
  );
}

// --- squad list -----------------------------------------------------------
function SquadList({
  ref,
  players,
  roles,
  captainId,
  focusId,
  onFocus,
  className,
}: {
  ref: Ref<HTMLElement>;
  players: readonly PlayerView[];
  roles: Map<string, PlayerView['role']>;
  captainId: string;
  focusId: string;
  onFocus(id: string): void;
  className?: string;
}) {
  const [filter, setFilter] = useState<'all' | PlayerView['role']>('all');
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  const list = players.filter(
    (player) =>
      (filter === 'all' || roles.get(player.id) === filter) &&
      (!normalized ||
        player.name.toLocaleLowerCase('pt-BR').includes(normalized) ||
        player.primaryPosition.toLowerCase().includes(normalized)),
  );
  const groups = groupByPosition(list);
  return (
    <section
      ref={ref}
      aria-labelledby="album"
      data-testid="lista-elenco"
      className={cn('panel flex scroll-mt-20 flex-col gap-2 p-2', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="album" className="font-pixel text-[.6rem] uppercase">
          Elenco <span className="text-muted-foreground">{players.length}</span>
        </h3>
        <ToggleGroup
          type="single"
          aria-label="Filtrar por grupo"
          value={filter}
          onValueChange={(value) => value && setFilter(value as typeof filter)}
          className="grid grid-cols-4"
        >
          <ToggleGroupItem value="all" className="min-h-9 px-2 text-[.55rem]">
            Todos
          </ToggleGroupItem>
          {(['starter', 'bench', 'reserve'] as const).map((role) => (
            <ToggleGroupItem
              key={role}
              value={role}
              className="min-h-9 px-2 text-[.55rem]"
            >
              {roleLabel[role]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <label className="relative block">
        <span className="sr-only">Buscar atleta</span>
        <MagnifyingGlass
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder="Buscar por nome ou posição"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-10 pl-8"
        />
      </label>
      {groups.length === 0 && (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          Ninguém com esse nome neste grupo.
        </p>
      )}
      {groups.map((group) => (
        <div key={group.id} className="grid gap-1">
          <h4 className="px-1 font-pixel text-[.5rem] uppercase text-muted-foreground">
            {group.label} <span className="led">{group.players.length}</span>
          </h4>
          <ul role="list" aria-label={group.label} className="grid gap-1">
            {group.players.map((player) => {
              const role = roles.get(player.id) ?? 'reserve';
              const unavailable = player.injuryRounds > 0 || player.suspended;
              return (
                <li key={player.id}>
                  <button
                    type="button"
                    data-player-row={player.id}
                    aria-pressed={player.id === focusId}
                    aria-label={`${player.name}, ${player.primaryPosition}, força ${String(player.strength)}, ${roleLabel[role].toLowerCase()}${captainId === player.id ? ', capitão' : ''}${unavailable ? ', indisponível' : ''}`}
                    onClick={() => onFocus(player.id)}
                    className={cn(
                      'sticker grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2 px-2 py-1 text-left',
                      player.id === focusId && 'outline outline-4 outline-bulb',
                      unavailable && 'saturate-50',
                    )}
                  >
                    <PixelAvatar seed={`atleta-${player.id}`} size={28} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold leading-tight">
                        {player.name}
                        {captainId === player.id && (
                          <Star
                            size={10}
                            weight="fill"
                            aria-hidden="true"
                            className="ml-1 inline text-bulb"
                          />
                        )}
                      </span>
                      <span className="block truncate text-[.6rem] text-muted-foreground">
                        {player.age} anos · {player.primaryPosition}
                        {player.secondaryPositions.length > 0 &&
                          ` / ${player.secondaryPositions.join(', ')}`}
                        {unavailable &&
                          ` · ${player.suspended ? 'suspenso' : 'lesionado'}`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'font-pixel text-[.45rem] uppercase',
                        role === 'starter'
                          ? 'bg-bulb px-1 text-ink'
                          : role === 'bench'
                            ? 'bg-wood px-1 text-chalk'
                            : 'bg-muted px-1 text-muted-foreground',
                      )}
                    >
                      {roleLabel[role]}
                    </span>
                    <span className="led bg-board px-1 text-sm">
                      {player.strength}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

// --- saved lineups and tactics (unchanged) --------------------------------
function SavedLineups({
  saved,
  name,
  onName,
  onSave,
  onApply,
  onRemove,
}: {
  saved: readonly SavedLineup[];
  name: string;
  onName(value: string): void;
  onSave(): void;
  onApply(lineup: SavedLineup): void;
  onRemove(name: string): void;
}) {
  return (
    <section aria-labelledby="escalacoes-salvas" className="panel p-2">
      <h3 id="escalacoes-salvas" className="font-pixel text-[.55rem] uppercase">
        Escalações salvas{' '}
        <span className="text-muted-foreground">
          {saved.length}/{MAX_SAVED_LINEUPS}
        </span>
      </h3>
      <form
        className="mt-2 flex gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <Input
          aria-label="Nome da escalação"
          placeholder="Ex.: Clássico"
          maxLength={24}
          value={name}
          onChange={(event) => onName(event.target.value)}
          className="min-h-10 flex-1"
        />
        <Button type="submit" size="sm" variant="secondary">
          <FloppyDisk data-icon="inline-start" />
          Guardar
        </Button>
      </form>
      <ul role="list" className="mt-2 flex flex-col gap-1">
        {saved.map((lineup) => (
          <li
            key={lineup.name}
            className="flex items-center justify-between gap-2 bg-muted px-2 py-1 text-xs"
          >
            <span className="min-w-0 truncate">
              <strong>{lineup.name}</strong>{' '}
              <span className="text-muted-foreground">
                {lineup.board.formation}
              </span>
            </span>
            <span className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onApply(lineup)}
                aria-label={`Aplicar escalação ${lineup.name}`}
              >
                Aplicar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemove(lineup.name)}
                aria-label={`Apagar escalação ${lineup.name}`}
              >
                <Trash />
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[.6rem] text-muted-foreground">
        Guardadas neste aparelho, por carreira.
      </p>
    </section>
  );
}

function TacticsPanel({
  formation,
  tactics,
  busy,
  onFormation,
  onChange,
  onPreset,
  onSave,
}: {
  formation: ServerFormation;
  tactics: TacticsView;
  busy: boolean;
  onFormation(value: ServerFormation): void;
  onChange(value: TacticsView): void;
  onPreset(id: string): void;
  onSave(): void;
}) {
  const change = <K extends keyof TacticsView>(key: K, value: TacticsView[K]) =>
    onChange({ ...tactics, [key]: value });
  const choice = <K extends keyof TacticsView>(
    key: K,
    label: string,
    options: readonly TacticsView[K][],
  ) => {
    const id = `tatica-${key}`;
    const labels = TACTIC_LABEL[key] as Record<string, string>;
    return (
      <div key={key} className="grid gap-1">
        <span id={id} className="font-pixel text-[.55rem] uppercase">
          {label}
        </span>
        <ToggleGroup
          type="single"
          aria-labelledby={id}
          value={tactics[key]}
          onValueChange={(value) =>
            value && change(key, value as TacticsView[K])
          }
          className={cn(
            'grid',
            options.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
          )}
        >
          {options.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className="min-h-10 px-2"
            >
              {labels[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    );
  };
  return (
    <div className="grid gap-3">
      <section aria-labelledby="prancheta" className="panel grid gap-3 p-3">
        <h3 id="prancheta" className="font-pixel text-[.6rem] uppercase">
          Prancheta
        </h3>
        <div className="grid gap-1">
          <span
            id="tatica-formacao"
            className="font-pixel text-[.55rem] uppercase"
          >
            Formação
          </span>
          <ToggleGroup
            type="single"
            aria-labelledby="tatica-formacao"
            value={formation}
            onValueChange={(value) =>
              value && onFormation(value as ServerFormation)
            }
            className="grid grid-cols-3"
          >
            {SERVER_FORMATIONS.map((option) => (
              <ToggleGroupItem key={option} value={option} className="min-h-10">
                {option}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {choice('mentality', 'Mentalidade', [
          'cautious',
          'balanced',
          'attacking',
        ])}
        {choice('buildUp', 'Construção', ['short', 'mixed', 'direct'])}
        {choice('focus', 'Foco ofensivo', ['middle', 'wings'])}
        {choice('press', 'Pressão', ['low', 'medium', 'high'])}
        {choice('defensiveLine', 'Linha defensiva', [
          'deep',
          'standard',
          'high',
        ])}
        {choice('marking', 'Marcação', ['light', 'strong', 'very-strong'])}
        <Button className="min-h-11" disabled={busy} onClick={onSave}>
          <CheckCircle data-icon="inline-start" />
          Salvar tática
        </Button>
      </section>
      <section
        aria-labelledby="presets"
        className="panel-board grid content-start gap-2 p-3"
      >
        <h3
          id="presets"
          className="font-pixel text-[.6rem] uppercase text-chalk"
        >
          Presets
        </h3>
        {TACTIC_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="btn-px btn-chalk grid gap-0.5 px-3 py-2 text-left"
            onClick={() => onPreset(preset.id)}
          >
            <span className="flex items-center justify-between text-[.6rem]">
              <span>{preset.name}</span>
              <span className="led bg-board px-1">{preset.formation}</span>
            </span>
            <span className="font-sans text-[.65rem] normal-case text-muted-foreground">
              {preset.description}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}
