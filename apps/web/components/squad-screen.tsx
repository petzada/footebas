'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowsClockwise,
  CheckCircle,
  FloppyDisk,
  Sparkle,
  Trash,
  UsersThree,
} from '@phosphor-icons/react';
import { AthleteCard } from '@/components/athlete-card';
import { PixelAvatar } from '@/components/retro/pixel-avatar';
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
  boardRoles,
  boardStrength,
  buildBoard,
  chemistryLabel,
  FORMATION_LAYOUT,
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
  type SavedLineup,
  type ServerFormation,
} from '@/lib/management-model';
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

/**
 * Elenco (docs/09): chalkboard pitch with the eleven on their slots, bench
 * and reserves. Players move by dragging (pointer events, so touch works) or
 * by selecting one and then its destination; both go through the same
 * `placePlayer`, and the board is validated before `SetLineup` is sent.
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
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [tactics, setTactics] = useState<TacticsView>(career.tactics);
  const careerKey = career.careerId ?? career.club;
  // Read once per mount: the shell remounts the screen per career.
  const [saved, setSaved] = useState<SavedLineup[]>(() =>
    loadSavedLineups(careerKey),
  );
  const [lineupName, setLineupName] = useState('');

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
  const onClickPlayer = (playerId: string) => {
    // A completed drag already placed the player; skip the synthetic click.
    if (dragging) return;
    onPlayerActivate(playerId);
  };

  const run = async (label: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      reportError('');
      await action();
      play('confirm');
      announce(label);
    } catch (caught) {
      play('error');
      const message =
        caught instanceof Error ? caught.message : 'Tente novamente.';
      reportError(message);
      ticker.announce(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveLineup = () =>
    run('Escalação enviada ao vestiário.', async () => {
      if (problems.length) throw new Error(problems[0]);
      onCareerChange(await api.setLineup(lineupInput(board, players)));
      setDirty(false);
    });

  const autoPick = (strategy: AutoPickStrategy) =>
    run('Escalação automática aplicada.', async () => {
      onCareerChange(await api.autoPick(strategy));
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

  const roles = boardRoles(board);
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const focused = byId.get(focusId) ?? players[0];
  const chemistry = career.chemistry;

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
            'sticker grid w-[4.6rem] touch-none select-none place-items-center gap-1 px-1 pb-1 pt-1.5 text-center',
            selectedId === playerId && 'outline outline-4 outline-bulb',
            dragging?.playerId === playerId && 'opacity-40',
            unavailable && 'saturate-50',
          )}
          onPointerDown={(event) => onPointerDown(event, playerId)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setDragging(null);
          }}
          onClick={() => onClickPlayer(playerId)}
        >
          <PixelAvatar seed={`atleta-${playerId}`} size={32} />
          <span className="w-full truncate text-[.62rem] font-bold leading-tight">
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
          className="btn-px btn-chalk px-2 py-1 text-[.5rem] disabled:opacity-60"
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
        className="mt-2 flex min-h-[5.5rem] gap-1 overflow-x-auto pb-1"
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
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <div
            role="group"
            aria-label="Escalações automáticas"
            className="flex gap-1"
          >
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void autoPick('best')}
            >
              <Sparkle data-icon="inline-start" />
              Melhor
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void autoPick('rest')}
            >
              <ArrowsClockwise data-icon="inline-start" />
              Poupar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void autoPick('develop')}
            >
              <UsersThree data-icon="inline-start" />
              Desenvolver
            </Button>
          </div>
          <Button
            variant="play"
            size="sm"
            disabled={busy || !dirty}
            onClick={() => void saveLineup()}
            aria-describedby={
              problems.length ? 'problemas-escalacao' : undefined
            }
          >
            <CheckCircle data-icon="inline-start" />
            Salvar escalação
          </Button>
        </div>
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

      <Tabs defaultValue={initialTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="board">Campo</TabsTrigger>
          <TabsTrigger value="tactics">Táticas</TabsTrigger>
          <TabsTrigger value="list">Elenco</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]">
            <div className="flex flex-col gap-2">
              <p className="px-1 text-xs text-chalk">
                {selected
                  ? `${selected.name} selecionado: toque na posição, no banco ou nas reservas.`
                  : 'Arraste um jogador ou toque nele e depois no destino. Pelo teclado: Enter seleciona e Enter no destino confirma.'}
              </p>
              <div
                className="pitch panel-chalk relative aspect-[3/4] w-full select-none overflow-hidden"
                role="group"
                aria-label={`Campo tático ${board.formation}`}
                onKeyDown={(event: KeyboardEvent) => {
                  if (event.key === 'Escape' && selectedId) {
                    setSelectedId(null);
                    announce('Seleção cancelada.');
                  }
                }}
              >
                {layout.map((slot, index) => {
                  const id = board.slots[index];
                  const player = id ? byId.get(id) : undefined;
                  const fit = player ? positionFit(player, slot.position) : 0;
                  const key = targetKey({ kind: 'slot', index });
                  const unavailable =
                    player && (player.injuryRounds > 0 || player.suspended);
                  return (
                    <button
                      key={key}
                      type="button"
                      data-drop={key}
                      data-slot-position={slot.position}
                      aria-pressed={Boolean(player && selectedId === player.id)}
                      aria-label={
                        player
                          ? `${POSITION_NAME[slot.position]}: ${player.name}, força ${String(player.strength)}${fit === 2 ? '' : fit === 1 ? ', posição secundária' : ', fora de posição'}${unavailable ? ', indisponível' : ''}`
                          : `${POSITION_NAME[slot.position]}: vaga livre`
                      }
                      className={cn(
                        'absolute flex w-[4.4rem] -translate-x-1/2 -translate-y-1/2 touch-none flex-col items-center gap-0.5 text-center',
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
                      onPointerCancel={() => {
                        drag.current = null;
                        setDragging(null);
                      }}
                      onClick={() => {
                        if (dragging) return;
                        if (selectedId)
                          onTargetActivate({ kind: 'slot', index });
                        else if (player) onPlayerActivate(player.id);
                      }}
                    >
                      <span
                        className={cn(
                          'relative grid size-11 place-items-center bg-chalk px-border',
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
                          <PixelAvatar seed={`atleta-${player.id}`} size={36} />
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
                        {unavailable && (
                          <span
                            aria-hidden="true"
                            className="absolute -bottom-1 -left-1 bg-destructive px-0.5 font-pixel text-[.4rem] text-chalk"
                          >
                            !
                          </span>
                        )}
                      </span>
                      <span className="w-full truncate bg-ink/80 px-1 text-[.6rem] font-bold leading-tight text-chalk">
                        {player ? lastName(player.name) : 'Vaga'}
                      </span>
                      {player && (
                        <span className="led text-[.6rem] leading-none">
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
            </div>
            <div className="flex flex-col gap-3">
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

        <TabsContent value="list">
          <SquadList
            career={career}
            roles={roles}
            focusId={focused?.id ?? ''}
            onFocus={(id) => {
              setFocusId(id);
              play('click');
            }}
            onMove={(id, target) => place(id, target)}
            board={board}
          />
        </TabsContent>
      </Tabs>

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
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,.6fr)]">
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

const roleLabel = {
  starter: 'Titular',
  bench: 'Banco',
  reserve: 'Reserva',
} as const;

function SquadList({
  career,
  roles,
  focusId,
  onFocus,
  onMove,
  board,
}: {
  career: CareerView;
  roles: Map<string, PlayerView['role']>;
  focusId: string;
  onFocus(id: string): void;
  onMove(id: string, target: BoardTarget): void;
  board: LineupBoard;
}) {
  const [filter, setFilter] = useState<'all' | PlayerView['role']>('all');
  const list = career.players.filter(
    (player) => filter === 'all' || roles.get(player.id) === filter,
  );
  const focused = career.players.find((player) => player.id === focusId);
  const layout = FORMATION_LAYOUT[board.formation];
  // Best slot for a player: natural position first, then secondary.
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
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,.7fr)]">
      <section aria-labelledby="album" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3
            id="album"
            className="font-pixel text-[.6rem] uppercase text-chalk"
          >
            Álbum do elenco
          </h3>
          <ToggleGroup
            type="single"
            aria-label="Filtrar por grupo"
            value={filter}
            onValueChange={(value) =>
              value && setFilter(value as typeof filter)
            }
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
        <ul
          role="list"
          aria-label="Jogadores"
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
        >
          {list.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                className="w-full text-left"
                aria-pressed={player.id === focusId}
                onClick={() => onFocus(player.id)}
              >
                <AthleteCard
                  player={player}
                  club={{ name: career.club }}
                  compact
                  selected={player.id === focusId}
                />
                <span className="sr-only">
                  {roleLabel[roles.get(player.id) ?? 'reserve']}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {focused && (
        <section
          aria-label={`Detalhes de ${focused.name}`}
          className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start"
        >
          <AthleteCard player={focused} club={{ name: career.club }} />
          <div className="panel grid gap-2 p-3 text-xs">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Jogos', String(focused.appearances)],
                ['Gols', String(focused.goals)],
                ['Nota', focused.lastRating?.toFixed(1) ?? '—'],
                ['Amarelos', String(focused.yellowCards)],
                ['Vermelhos', String(focused.redCards)],
                ['Idade', `${String(focused.age)}`],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted p-1">
                  <dt className="font-pixel text-[.45rem] uppercase text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="led bg-board text-base">{value}</dd>
                </div>
              ))}
            </dl>
            {[
              ['Condição', focused.condition],
              ['Moral', focused.morale],
              ['Ritmo', focused.sharpness],
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
                Consistência: focused.scoutingEstimates.consistency,
                Lesões: focused.scoutingEstimates.injuryProneness,
                Adaptação: focused.scoutingEstimates.adaptation,
                'Jogo grande': focused.scoutingEstimates.bigMatches,
              }).map(([label, value]) => (
                <li key={label}>
                  <Badge variant="outline">
                    <PixelStar size={8} />
                    {label}: {value}
                  </Badge>
                </li>
              ))}
            </ul>
            <div
              role="group"
              aria-label={`Mover ${focused.name}`}
              className="grid grid-cols-3 gap-1"
            >
              <Button
                size="sm"
                variant="secondary"
                disabled={roles.get(focused.id) === 'starter'}
                onClick={() =>
                  onMove(focused.id, { kind: 'slot', index: bestSlot(focused) })
                }
              >
                Titular
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={roles.get(focused.id) === 'bench'}
                onClick={() => onMove(focused.id, { kind: 'bench' })}
              >
                Banco
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={roles.get(focused.id) === 'reserve'}
                onClick={() => onMove(focused.id, { kind: 'reserves' })}
              >
                Reserva
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
