'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  Barbell,
  Briefcase,
  Car,
  HouseLine,
  Lightning,
  Megaphone,
  SoccerBall,
  X,
} from '@phosphor-icons/react';
import { ClubEmblem } from '@/components/club-emblem';
import { Button } from '@/components/ui/button';
import type { CareerView, Screen } from '@/lib/career-api';
import {
  setScreenOrigin,
  type ScreenOrigin,
} from '@/lib/retro/transition-origin';
import { useSound } from '@/lib/retro/use-sound';

/** Size of the illustration (SVG user units). */
const VIEW_W = 1200;
const VIEW_H = 740;

/** Rectangle: x, y, width, height (or depth, on the ground). */
type Rect = readonly [x: number, y: number, w: number, h: number];

export interface ClubArea {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: typeof Barbell;
  /** First link is where the map building itself leads. */
  readonly links: readonly (readonly [Screen, string])[];
  /** Bounding box of the building on the drawing (anchors the sheet). */
  readonly rect: Rect;
  /** Plot on the isometric ground: hit area, hover glow and focus ring. */
  readonly plot: Rect;
  /** Centre of the name tag on the drawing. */
  readonly label: readonly [x: number, y: number];
  /** Shorter text for the drawing, when the name does not fit. */
  readonly short?: string;
}

/** Buildings of the isometric club, in focus order. */
export const CLUB_AREAS: readonly ClubArea[] = [
  {
    id: 'ct',
    name: 'CT',
    description: 'Centro de treinamento: elenco e prancheta tática.',
    icon: Barbell,
    links: [
      ['squad', 'Elenco'],
      ['tactics', 'Táticas'],
    ],
    rect: [700, 280, 404, 240],
    plot: [340, 34, 202, 208],
    label: [806, 486],
  },
  {
    id: 'stadium',
    name: 'Estádio',
    description: 'Casa da torcida: ingressos, obras e dia de jogo.',
    icon: SoccerBall,
    links: [
      ['stadium', 'Estádio'],
      ['central', 'Partida'],
    ],
    rect: [388, 36, 424, 340],
    plot: [20, 32, 240, 216],
    label: [500, 346],
  },
  {
    id: 'hq',
    name: 'Sede',
    description: 'Escritório da diretoria, propostas e finanças.',
    icon: Briefcase,
    links: [
      ['office', 'Escritório'],
      ['finance', 'Finanças'],
    ],
    rect: [180, 205, 180, 220],
    plot: [36, 366, 98, 98],
    label: [196, 428],
  },
  {
    id: 'press',
    name: 'Imprensa',
    description: 'Sala de imprensa: manchetes e repercussão.',
    icon: Megaphone,
    links: [['inbox', 'Notícias']],
    rect: [220, 370, 150, 160],
    plot: [164, 474, 92, 82],
    label: [300, 552],
  },
  {
    id: 'parking',
    name: 'Estacionamento',
    description: 'Onde chegam e partem os reforços: mercado.',
    icon: Car,
    links: [['market', 'Mercado']],
    rect: [500, 445, 320, 180],
    plot: [336, 326, 218, 118],
    label: [674, 618],
    short: 'Mercado',
  },
  {
    id: 'home',
    name: 'Casa do treinador',
    description: 'Sua carreira, temporadas e conquistas.',
    icon: HouseLine,
    links: [['history', 'Carreira e histórico']],
    rect: [440, 520, 150, 120],
    plot: [384, 476, 92, 80],
    label: [520, 662],
    short: 'Casa',
  },
];

export function areaLabel(area: ClubArea): string {
  return `${area.name}: ${area.links.map(([, label]) => label).join(' e ')}`;
}

/** Where a building was tapped: viewport point plus the SVG anchor. */
export interface BuildingTap {
  readonly area: ClubArea;
  readonly origin: ScreenOrigin;
  /** The building element, to give focus back when the sheet closes. */
  readonly anchor: SVGGElement | null;
}

/** Mapa do clube: isometric night illustration; every building is a button. */
export function ClubMapScreen({
  career,
  navigate,
  onNarrate,
  onInstant,
}: {
  career: CareerView;
  navigate(value: Screen): void;
  onNarrate(): void;
  onInstant(): void;
}) {
  const { play } = useSound();
  const [open, setOpen] = useState<BuildingTap | null>(null);
  const go = (screen: Screen, origin: ScreenOrigin | null) => {
    play('click');
    setScreenOrigin(origin);
    navigate(screen);
  };
  const onBuilding = (tap: BuildingTap) => {
    if (tap.area.links.length === 1) {
      go(tap.area.links[0]![0], tap.origin);
      return;
    }
    play('click');
    setOpen(tap);
  };
  const close = () => {
    const anchor = open?.anchor;
    setOpen(null);
    anchor?.focus();
  };
  return (
    <div className="grid gap-4">
      <AdvanceBar career={career} onNarrate={onNarrate} onInstant={onInstant} />
      <section aria-labelledby="mapa-ilustrado" className="panel p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mapa-ilustrado" className="font-pixel text-[.86rem]">
            Seu clube
          </h2>
          <span className="rounded-sm bg-bulb px-2 py-1 font-display text-[.74rem] font-bold tracking-wide text-bulb-foreground uppercase">
            Toque num prédio
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada prédio abre uma tela do clube.
        </p>
        <nav
          aria-label="Áreas do mapa"
          className="px-border relative mt-3 overflow-hidden bg-ink lg:mx-auto lg:max-w-5xl"
        >
          <ClubScene club={career.club} onBuilding={onBuilding} />
          {open && (
            <BuildingSheet
              tap={open}
              onPick={(screen) => {
                setOpen(null);
                go(screen, open.origin);
              }}
              onClose={close}
            />
          )}
        </nav>
        {/* docs/09 decision 2: the same destinations as a plain list, for
            who prefers reading to tapping a drawing (D4). */}
        <nav
          aria-label="Áreas do clube em lista"
          className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {CLUB_AREAS.flatMap((area) =>
            area.links.map(([screen, label]) => (
              <Button
                key={`${area.id}-${screen}`}
                variant="outline"
                className="min-h-11 justify-start text-left"
                onClick={() => go(screen, null)}
              >
                <area.icon
                  weight="fill"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">
                  {area.name} · {label}
                </span>
              </Button>
            )),
          )}
        </nav>
      </section>
    </div>
  );
}

function AdvanceBar({
  career,
  onNarrate,
  onInstant,
}: {
  career: CareerView;
  onNarrate(): void;
  onInstant(): void;
}) {
  return (
    <section
      aria-label="Avançar no calendário"
      className="panel-board grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ClubEmblem name={career.opponent.club} size={40} decorative />
        <p className="min-w-0 text-sm">
          <span className="led block text-[.74rem] tracking-[.2em]">
            Próximo jogo
          </span>
          <strong className="block truncate font-pixel text-[.86rem] leading-relaxed sm:text-xs">
            {career.club} × {career.opponent.club}
          </strong>
        </p>
      </div>
      {career.fixture && (
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:flex">
          <button
            type="button"
            className="btn-px btn-play flex min-h-11 min-w-0 items-center justify-center gap-1 px-1.5 text-[.74rem] leading-tight break-words whitespace-normal sm:px-4 sm:text-[.86rem]"
            onClick={onNarrate}
          >
            <SoccerBall weight="fill" aria-hidden="true" />
            Jogar partida
          </button>
          <Button
            variant="outline"
            className="h-auto min-h-11 min-w-0 gap-1 px-1.5 text-[.74rem] leading-tight break-words whitespace-normal sm:px-4 sm:text-[.86rem]"
            onClick={onInstant}
          >
            <Lightning weight="fill" data-icon="inline-start" />
            Resultado instantâneo
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * Small sheet listing the screens of a building: anchored under the
 * building on wide screens, a short bottom sheet on phones. Traps focus,
 * closes on Esc, outside tap or the close button.
 */
function BuildingSheet({
  tap,
  onPick,
  onClose,
}: {
  tap: BuildingTap;
  onPick(screen: Screen): void;
  onClose(): void;
}) {
  const { area } = tap;
  const titleId = `sheet-${area.id}`;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-sheet-item]')?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>('button')];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const [x, y, w, h] = area.rect;
  // Anchor the sheet under the building (SVG units → percentages).
  const anchorX = Math.min(66, Math.max(2, ((x + w / 2) / VIEW_W) * 100 - 16));
  const anchorY = Math.min(64, ((y + h) / VIEW_H) * 100 - 4);
  const Icon = area.icon;
  return (
    <>
      <div
        data-testid="sheet-backdrop"
        className="fixed inset-0 z-40 bg-ink/50 sm:absolute sm:bg-ink/20"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="building-sheet"
        style={
          {
            '--anchor-x': `${anchorX}%`,
            '--anchor-y': `${anchorY}%`,
          } as CSSProperties
        }
        className="panel px-rise fixed inset-x-2 bottom-[max(.5rem,env(safe-area-inset-bottom))] z-50 grid gap-2 p-3 sm:absolute sm:inset-auto sm:top-[var(--anchor-y)] sm:left-[var(--anchor-x)] sm:w-44"
        onKeyDown={onKeyDown}
      >
        <header className="flex items-center justify-between gap-2">
          <h3
            id={titleId}
            className="flex min-w-0 items-center gap-2 font-pixel text-[.82rem] leading-relaxed"
          >
            <Icon
              weight="fill"
              className="size-4 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{area.name}</span>
          </h3>
          <button
            type="button"
            aria-label="Fechar"
            className="btn-px btn-chalk inline-flex size-9 items-center justify-center"
            onClick={onClose}
          >
            <X weight="bold" aria-hidden="true" />
          </button>
        </header>
        <p className="sr-only">{area.description}</p>
        <div className="grid gap-3">
          {area.links.map(([screen, label]) => (
            <Button
              key={screen}
              variant="outline"
              data-sheet-item
              className="min-h-10 justify-start"
              onClick={() => onPick(screen)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}

// --- isometric drawing (2:1 dimetric, night scene) ---------------------------

/*
 * The club sits on a 580 × 580 ground plate seen from above and to the front:
 * world x runs down-right, world y runs down-left and z goes up. Everything
 * is generated from these numbers; no bitmap, no external asset.
 */
const ORIGIN_X = 600;
const ORIGIN_Y = 130;
const GROUND = 580;

/** Point in world space: x, y on the ground and optional height. */
type P3 = readonly [x: number, y: number, z?: number];

const round = (value: number) => Math.round(value * 10) / 10;
const isoX = (x: number, y: number) => round(ORIGIN_X + x - y);
const isoY = (x: number, y: number, z = 0) => round(ORIGIN_Y + (x + y) / 2 - z);

function pts(...points: readonly P3[]): string {
  return points.map(([x, y, z]) => `${isoX(x, y)},${isoY(x, y, z)}`).join(' ');
}

function mix(a: P3, b: P3, t: number): P3 {
  const az = a[2] ?? 0;
  const bz = b[2] ?? 0;
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    az + (bz - az) * t,
  ];
}

function seg(a: P3, b: P3) {
  return {
    x1: isoX(a[0], a[1]),
    y1: isoY(a[0], a[1], a[2]),
    x2: isoX(b[0], b[1]),
    y2: isoY(b[0], b[1], b[2]),
  };
}

/** Footprint of a plot, grown by `grow`, as polygon points. */
function plotPoints([x, y, w, d]: Rect, grow = 0): string {
  return pts(
    [x - grow, y - grow],
    [x + w + grow, y - grow],
    [x + w + grow, y + d + grow],
    [x - grow, y + d + grow],
  );
}

/*
 * Illustration palette: artwork colors of the night scene, not UI tokens.
 * Highlights (gold thread, chalk lines, focus) use the theme tokens.
 */
const ART = {
  skyTop: '#0d1624',
  skyBottom: '#05080d',
  star: '#cfe0f5',
  earthLeft: '#0d141c',
  earthRight: '#080d13',
  grass: '#0f2a1d',
  grassEdge: '#16402b',
  pitchA: '#1f9a58',
  pitchB: '#1a8a4e',
  trainA: '#18794a',
  trainB: '#146b41',
  road: '#151c26',
  lot: '#1b2430',
  concreteTop: '#2b3646',
  concreteLeft: '#1f2835',
  concreteRight: '#161d27',
  wallTop: '#35425a',
  wallLeft: '#263247',
  wallRight: '#1a2434',
  glassTop: '#2f4160',
  glassLeft: '#1a2a44',
  glassRight: '#111d31',
  seatsA: '#27405f',
  seatsB: '#1e324d',
  deck: '#2c394b',
  roofTop: '#3a475b',
  roofSide: '#4a5a72',
  tile: '#8a3f37',
  tileDeep: '#5f2a25',
  windowWarm: '#ffd98a',
  windowCool: '#8fd3ff',
  windowOff: '#0e1723',
  pole: '#5c6b7f',
  steel: '#cfd8e3',
  trunk: '#2a2118',
  leaf: '#123a26',
  leafLit: '#1c5637',
  red: '#ef4444',
  cone: '#ff8a3d',
} as const;

const SCENE_CSS = `
.cm-scene .map-building .cm-art{transition:filter var(--beat,260ms) ease-out}
.cm-scene .map-building:hover .cm-art,.cm-scene .map-building:focus-visible .cm-art{filter:brightness(1.22) saturate(1.08)}
.cm-scene .cm-plate{fill:var(--bulb);opacity:0;transition:opacity var(--beat,260ms) ease-out}
.cm-scene .map-building:hover .cm-plate{opacity:.14}
.cm-scene .map-building:focus-visible .cm-plate{opacity:.24}
.cm-scene .map-building .map-focus{stroke-width:2;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.cm-scene .map-building:focus-visible .map-focus{stroke-width:4}
.cm-scene .cm-label-bg{fill:var(--board);fill-opacity:.92;stroke:var(--bulb);stroke-opacity:.55;transition:fill var(--tick,120ms) ease-out}
.cm-scene .cm-label-text{fill:var(--bulb);transition:fill var(--tick,120ms) ease-out}
.cm-scene .map-building:hover .cm-label-bg,.cm-scene .map-building:focus-visible .cm-label-bg{fill:var(--bulb);fill-opacity:1}
.cm-scene .map-building:hover .cm-label-text,.cm-scene .map-building:focus-visible .cm-label-text{fill:var(--bulb-foreground)}
.cm-scene .cm-label{transform-box:fill-box;transform-origin:center}
@media (max-width:639px){.cm-scene .cm-label{transform:scale(1.65)}}
@media (prefers-reduced-motion:no-preference){
.cm-scene .map-building .map-lift{transition:transform var(--beat,260ms) cubic-bezier(.22,1,.36,1)}
.cm-scene .map-building:hover .map-lift,.cm-scene .map-building:focus-visible .map-lift{transform:translateY(-9px)}
.cm-scene .cm-pulse{animation:cm-pulse 5.5s ease-in-out infinite}
.cm-scene .cm-twinkle{animation:cm-twinkle 4.2s ease-in-out infinite}
.cm-scene .cm-blink{animation:cm-blink 1.8s steps(2,end) infinite}
.cm-scene .cm-drive{animation:cm-drive 18s linear infinite}
}
@keyframes cm-pulse{50%{opacity:.62}}
@keyframes cm-twinkle{50%{opacity:.25}}
@keyframes cm-blink{50%{opacity:.15}}
@keyframes cm-drive{0%{transform:translate(-120px,-60px);opacity:0}6%{opacity:1}94%{opacity:1}100%{transform:translate(380px,190px);opacity:0}}
`;

/** Box standing on the ground: left face looks down-left, right down-right. */
function Block({
  x,
  y,
  w,
  d,
  h,
  z = 0,
  top,
  left,
  right,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  z?: number;
  top: string;
  left: string;
  right: string;
}) {
  const t = z + h;
  return (
    <>
      <polygon
        points={pts(
          [x, y + d, z],
          [x + w, y + d, z],
          [x + w, y + d, t],
          [x, y + d, t],
        )}
        fill={left}
      />
      <polygon
        points={pts(
          [x + w, y, z],
          [x + w, y + d, z],
          [x + w, y + d, t],
          [x + w, y, t],
        )}
        fill={right}
      />
      <polygon
        points={pts([x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t])}
        fill={top}
      />
    </>
  );
}

/** Flat rectangle lying at height z. */
function Flat({
  x,
  y,
  w,
  d,
  z = 0,
  fill,
  opacity,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  z?: number;
  fill: string;
  opacity?: number;
}) {
  return (
    <polygon
      points={pts([x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z])}
      fill={fill}
      opacity={opacity}
    />
  );
}

/**
 * Grid of windows on a face. `L`: the face at constant y, starting at `at`
 * and running along x. `R`: the face at constant x, running along y. Which
 * ones are lit is a fixed pattern (no randomness: server and client match).
 */
function Windows({
  face,
  at: [x, y],
  len,
  cols,
  rows = 1,
  z,
  h,
  gap = 4,
  seed = 0,
}: {
  face: 'L' | 'R';
  at: readonly [number, number];
  len: number;
  cols: number;
  rows?: number;
  z: number;
  h: number;
  gap?: number;
  seed?: number;
}) {
  const cell = len / cols;
  const pad = cell * 0.2;
  const panes = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = col * cell + pad;
      const b = (col + 1) * cell - pad;
      const z0 = z + row * (h + gap);
      const z1 = z0 + h;
      const kind = (row * 7 + col * 13 + seed * 5) % 6;
      const fill =
        kind === 0 || kind === 5
          ? ART.windowOff
          : kind === 3
            ? ART.windowCool
            : ART.windowWarm;
      panes.push(
        <polygon
          key={`${row}-${col}`}
          points={
            face === 'L'
              ? pts(
                  [x + a, y, z0],
                  [x + b, y, z0],
                  [x + b, y, z1],
                  [x + a, y, z1],
                )
              : pts(
                  [x, y + a, z0],
                  [x, y + b, z0],
                  [x, y + b, z1],
                  [x, y + a, z1],
                )
          }
          fill={fill}
          opacity={face === 'R' ? 0.78 : 1}
          className={kind === 4 ? 'cm-twinkle' : undefined}
          style={
            kind === 4 ? { animationDelay: `${(row + col) * 0.7}s` } : undefined
          }
        />,
      );
    }
  }
  return <>{panes}</>;
}

/** Mowed stripes plus chalk markings of a pitch lying at height z. */
function Pitch({
  x,
  y,
  w,
  d,
  z = 0,
  stripes,
  colors,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  z?: number;
  stripes: number;
  colors: readonly [string, string];
}) {
  const band = w / stripes;
  const midX = x + w / 2;
  const midY = y + d / 2;
  const box = Math.min(24, w / 7);
  const boxHalf = d * 0.28;
  const radius = Math.min(w, d) * 0.12;
  return (
    <g>
      {Array.from({ length: stripes }, (_, i) => (
        <Flat
          key={i}
          x={x + i * band}
          y={y}
          w={band}
          d={d}
          z={z}
          fill={colors[i % 2]!}
        />
      ))}
      <g
        fill="none"
        stroke="var(--chalk)"
        strokeOpacity={0.8}
        strokeWidth={1.4}
        strokeLinejoin="round"
      >
        <polygon
          points={pts(
            [x + 4, y + 4, z],
            [x + w - 4, y + 4, z],
            [x + w - 4, y + d - 4, z],
            [x + 4, y + d - 4, z],
          )}
        />
        <line {...seg([midX, y + 4, z], [midX, y + d - 4, z])} />
        <ellipse
          cx={isoX(midX, midY)}
          cy={isoY(midX, midY, z)}
          rx={radius * 1.414}
          ry={radius * 0.707}
        />
        <polyline
          points={pts(
            [x + 4, midY - boxHalf, z],
            [x + 4 + box, midY - boxHalf, z],
            [x + 4 + box, midY + boxHalf, z],
            [x + 4, midY + boxHalf, z],
          )}
        />
        <polyline
          points={pts(
            [x + w - 4, midY - boxHalf, z],
            [x + w - 4 - box, midY - boxHalf, z],
            [x + w - 4 - box, midY + boxHalf, z],
            [x + w - 4, midY + boxHalf, z],
          )}
        />
        {/* goals */}
        <polyline
          strokeOpacity={1}
          strokeWidth={1.8}
          points={pts(
            [x + 4, midY - 9, z],
            [x + 4, midY - 9, z + 7],
            [x + 4, midY + 9, z + 7],
            [x + 4, midY + 9, z],
          )}
        />
        <polyline
          strokeOpacity={1}
          strokeWidth={1.8}
          points={pts(
            [x + w - 4, midY - 9, z],
            [x + w - 4, midY - 9, z + 7],
            [x + w - 4, midY + 9, z + 7],
            [x + w - 4, midY + 9, z],
          )}
        />
      </g>
    </g>
  );
}

function Tree({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  const cx = isoX(x, y);
  const cy = isoY(x, y);
  return (
    <g>
      <ellipse
        cx={cx + 4}
        cy={cy + 1}
        rx={12 * size}
        ry={5 * size}
        opacity={0.4}
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - 10 * size}
        stroke={ART.trunk}
        strokeWidth={3}
      />
      <circle cx={cx} cy={cy - 19 * size} r={11 * size} fill={ART.leaf} />
      <circle
        cx={cx - 3 * size}
        cy={cy - 22 * size}
        r={6.5 * size}
        fill={ART.leafLit}
      />
    </g>
  );
}

/** Street lamp with a warm pool of light on the ground. */
function Lamp({ x, y }: { x: number; y: number }) {
  const cx = isoX(x, y);
  const cy = isoY(x, y);
  return (
    <g>
      <ellipse
        cx={cx}
        cy={cy}
        rx={34}
        ry={17}
        fill="url(#cm-warm)"
        opacity={0.55}
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - 24}
        stroke={ART.pole}
        strokeWidth={2}
      />
      <circle cx={cx} cy={cy - 25} r={9} fill="url(#cm-warm)" />
      <circle cx={cx} cy={cy - 25} r={2.6} fill="var(--bulb)" />
    </g>
  );
}

/** Floodlight tower: pole, lamp bank and a slow pulsing halo. */
function Flood({
  x,
  y,
  h,
  delay = 0,
  small = false,
}: {
  x: number;
  y: number;
  h: number;
  delay?: number;
  small?: boolean;
}) {
  const cx = isoX(x, y);
  const base = isoY(x, y);
  const top = base - h;
  const k = small ? 0.6 : 1;
  return (
    <g>
      <line
        x1={cx}
        y1={base}
        x2={cx}
        y2={top}
        stroke={ART.pole}
        strokeWidth={small ? 2 : 3.5}
      />
      <rect
        x={cx - 11 * k}
        y={top - 9 * k}
        width={22 * k}
        height={13 * k}
        rx={2}
        fill={ART.concreteRight}
        stroke={ART.pole}
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle
          key={i}
          cx={cx + (-6.5 + (i % 3) * 6.5) * k}
          cy={top + (-5.5 + Math.floor(i / 3) * 5.5) * k}
          r={2.1 * k}
          fill="#fff"
        />
      ))}
      <circle
        className="cm-pulse"
        style={{ animationDelay: `${delay}s` }}
        cx={cx}
        cy={top - 2}
        r={30 * k}
        fill="url(#cm-glow)"
        pointerEvents="none"
      />
    </g>
  );
}

/** Small parked car pointing down-left (along world y). */
function ParkedCar({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <Flat x={x + 3} y={y + 3} w={14} d={26} fill="#000" opacity={0.35} />
      <Block
        x={x}
        y={y}
        w={14}
        d={26}
        h={7}
        top={color}
        left={color}
        right={color}
      />
      <Block
        x={x + 1.5}
        y={y + 7}
        w={11}
        d={12}
        z={7}
        h={5}
        top={ART.glassTop}
        left={ART.windowOff}
        right={ART.windowOff}
      />
      <polygon
        points={pts(
          [x, y + 26, 0],
          [x + 14, y + 26, 0],
          [x + 14, y + 26, 7],
          [x, y + 26, 7],
        )}
        fill="#000"
        opacity={0.28}
      />
      <polygon
        points={pts(
          [x + 14, y, 0],
          [x + 14, y + 26, 0],
          [x + 14, y + 26, 7],
          [x + 14, y, 7],
        )}
        fill="#000"
        opacity={0.45}
      />
      <circle
        cx={isoX(x + 2.5, y + 26)}
        cy={isoY(x + 2.5, y + 26, 4)}
        r={1.5}
        fill={ART.windowWarm}
      />
      <circle
        cx={isoX(x + 11.5, y + 26)}
        cy={isoY(x + 11.5, y + 26, 4)}
        r={1.5}
        fill={ART.windowWarm}
      />
    </g>
  );
}

// Stadium numbers: outer bowl, inner pitch edge, heights of the stands.
const ST = {
  x0: 28,
  y0: 40,
  x1: 252,
  y1: 240,
  ix0: 62,
  iy0: 74,
  ix1: 218,
  iy1: 206,
  z: 5,
  back: 52,
  front: 28,
} as const;

const CROWD = [
  'var(--chalk)',
  'var(--bulb)',
  ART.windowCool,
  'var(--grass-light, #4be08f)',
];

/** Supporters on a sloped stand, between its inner and outer edges. */
function Crowd({
  inner,
  outer,
  count,
}: {
  inner: readonly [P3, P3];
  outer: readonly [P3, P3];
  count: number;
}) {
  return (
    <g pointerEvents="none">
      {[1, 2, 3, 4, 5].map((row) => {
        const t = row / 6;
        return (
          <line
            key={`row-${row}`}
            {...seg(mix(inner[0], outer[0], t), mix(inner[1], outer[1], t))}
            stroke="#fff"
            strokeOpacity={0.09}
          />
        );
      })}
      {Array.from({ length: count }, (_, i) => {
        const u = 0.04 + ((i * 0.618) % 1) * 0.92;
        const v = 0.08 + ((i * 0.371 + 0.2) % 1) * 0.84;
        const [x, y, z] = mix(
          mix(inner[0], inner[1], u),
          mix(outer[0], outer[1], u),
          v,
        );
        const flash = i % 11 === 0;
        return (
          <circle
            key={i}
            cx={isoX(x, y)}
            cy={isoY(x, y, z)}
            r={flash ? 2.2 : 1.5}
            fill={flash ? '#fff' : CROWD[i % CROWD.length]}
            opacity={flash ? 1 : 0.6}
            className={flash ? 'cm-twinkle' : undefined}
            style={flash ? { animationDelay: `${(i % 7) * 0.6}s` } : undefined}
          />
        );
      })}
    </g>
  );
}

function StadiumArt() {
  const { x0, y0, x1, y1, ix0, iy0, ix1, iy1, z, back, front } = ST;
  const midX = (x0 + x1) / 2;
  const midY = (y0 + y1) / 2;
  const spot: readonly [P3, P3] = [
    [midX - 48, midY + 48, z],
    [midX + 48, midY - 48, z],
  ];
  return (
    <g>
      <ellipse
        className="cm-pulse"
        cx={isoX(midX, midY)}
        cy={isoY(midX, midY)}
        rx={300}
        ry={170}
        fill="url(#cm-spill)"
        pointerEvents="none"
      />
      <Block
        x={x0 - 8}
        y={y0 - 8}
        w={x1 - x0 + 16}
        d={y1 - y0 + 16}
        h={3}
        top={ART.concreteTop}
        left={ART.concreteLeft}
        right={ART.concreteRight}
      />
      <Pitch
        x={ix0}
        y={iy0}
        w={ix1 - ix0}
        d={iy1 - iy0}
        z={z}
        stripes={6}
        colors={[ART.pitchA, ART.pitchB]}
      />
      {/* back stands: the seats face the viewer */}
      <polygon
        points={pts(
          [x0, y0, back],
          [x1, y0, back],
          [ix1, iy0, z],
          [ix0, iy0, z],
        )}
        fill={ART.seatsA}
      />
      <polygon
        points={pts(
          [x0, y0, back],
          [x0, y1, back],
          [ix0, iy1, z],
          [ix0, iy0, z],
        )}
        fill={ART.seatsB}
      />
      <Crowd
        inner={[
          [ix0, iy0, z],
          [ix1, iy0, z],
        ]}
        outer={[
          [x0, y0, back],
          [x1, y0, back],
        ]}
        count={46}
      />
      <Crowd
        inner={[
          [ix0, iy0, z],
          [ix0, iy1, z],
        ]}
        outer={[
          [x0, y0, back],
          [x0, y1, back],
        ]}
        count={40}
      />
      {/* canopy over the back stands, with the gold thread on its rim */}
      <polygon
        points={pts(
          [x0 - 5, y0 - 5, back + 15],
          [x1 + 5, y0 - 5, back + 15],
          [x1 - 12, y0 + 22, back + 8],
          [x0 + 22, y0 + 22, back + 8],
        )}
        fill={ART.roofTop}
      />
      <polygon
        points={pts(
          [x0 - 5, y0 - 5, back + 15],
          [x0 - 5, y1 + 5, back + 15],
          [x0 + 22, y1 - 12, back + 8],
          [x0 + 22, y0 + 22, back + 8],
        )}
        fill={ART.roofSide}
      />
      <polyline
        points={pts(
          [x1 - 12, y0 + 22, back + 8],
          [x0 + 22, y0 + 22, back + 8],
          [x0 + 22, y1 - 12, back + 8],
        )}
        fill="none"
        stroke="var(--bulb)"
        strokeWidth={1.6}
      />
      <Flood x={x0 - 6} y={y0 - 6} h={125} />
      {/* corners where the back stands step down to the front ones */}
      <polygon
        points={pts([x1, y0, back], [x1, iy0, front], [ix1, iy0, z])}
        fill={ART.deck}
      />
      <polygon
        points={pts([x0, y1, back], [ix0, y1, front], [ix0, iy1, z])}
        fill={ART.deck}
      />
      {/* front stands: outer walls and roof deck */}
      <polygon
        points={pts(
          [x1, iy0, front],
          [x1, y1, front],
          [ix1, iy1, z],
          [ix1, iy0, z],
        )}
        fill={ART.deck}
      />
      <polygon
        points={pts(
          [ix0, y1, front],
          [x1, y1, front],
          [ix1, iy1, z],
          [ix0, iy1, z],
        )}
        fill={ART.roofTop}
      />
      <polygon
        points={pts(
          [x1, y0, 0],
          [x1, y1, 0],
          [x1, y1, front],
          [x1, iy0, front],
          [x1, y0, back],
        )}
        fill={ART.wallRight}
      />
      <polygon
        points={pts(
          [x0, y1, 0],
          [x1, y1, 0],
          [x1, y1, front],
          [ix0, y1, front],
          [x0, y1, back],
        )}
        fill={ART.wallLeft}
      />
      <Windows
        face="L"
        at={[x0 + 40, y1]}
        len={x1 - x0 - 48}
        cols={9}
        z={14}
        h={6}
        seed={1}
      />
      <Windows
        face="R"
        at={[x1, y0 + 40]}
        len={y1 - y0 - 48}
        cols={8}
        z={14}
        h={6}
        seed={2}
      />
      {/* main gate */}
      <polygon
        points={pts([126, y1, 3], [158, y1, 3], [158, y1, 11], [126, y1, 11])}
        fill={ART.windowWarm}
      />
      <polyline
        points={pts(
          [x0, y1, back - 3],
          [ix0, y1, front - 3],
          [x1, y1, front - 3],
          [x1, iy0, front - 3],
          [x1, y0, back - 3],
        )}
        fill="none"
        stroke="var(--bulb)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Flood x={x1 + 6} y={y0 - 6} h={110} delay={1.4} />
      <Flood x={x0 - 6} y={y1 + 6} h={110} delay={2.6} />
      <Flood x={x1 + 6} y={y1 + 6} h={96} delay={0.8} />
      {/* light cones falling on the pitch */}
      <g className="cm-pulse" pointerEvents="none" opacity={0.5}>
        <polygon
          points={pts([x0 - 6, y0 - 6, 125], ...spot)}
          fill="url(#cm-cone)"
        />
        <polygon
          points={pts([x1 + 6, y0 - 6, 110], ...spot)}
          fill="url(#cm-cone)"
        />
        <polygon
          points={pts([x0 - 6, y1 + 6, 110], ...spot)}
          fill="url(#cm-cone)"
        />
      </g>
    </g>
  );
}

function TrainingArt() {
  return (
    <g>
      <Flat x={356} y={46} w={184} d={52} fill="#000" opacity={0.35} />
      {/* gym and locker rooms */}
      <Block
        x={350}
        y={40}
        w={118}
        d={50}
        h={36}
        top={ART.wallTop}
        left={ART.wallLeft}
        right={ART.wallRight}
      />
      <Flat
        x={362}
        y={50}
        w={60}
        d={26}
        z={36}
        fill={ART.windowCool}
        opacity={0.22}
      />
      <Windows
        face="L"
        at={[354, 90]}
        len={110}
        cols={6}
        rows={2}
        z={7}
        h={9}
        gap={5}
        seed={3}
      />
      <Windows
        face="R"
        at={[468, 44]}
        len={42}
        cols={2}
        rows={2}
        z={7}
        h={9}
        gap={5}
        seed={1}
      />
      <line
        {...seg([350, 90, 36], [468, 90, 36])}
        stroke="var(--bulb)"
        strokeWidth={1.6}
      />
      {/* youth academy dorm */}
      <Block
        x={478}
        y={50}
        w={56}
        d={40}
        h={22}
        top={ART.concreteTop}
        left={ART.concreteLeft}
        right={ART.concreteRight}
      />
      <Windows face="L" at={[480, 90]} len={52} cols={4} z={7} h={8} seed={4} />
      <Windows face="R" at={[534, 53]} len={34} cols={2} z={7} h={8} seed={2} />
      {/* training pitch */}
      <Flat x={342} y={108} w={196} d={132} fill={ART.grassEdge} />
      <Pitch
        x={346}
        y={112}
        w={188}
        d={124}
        stripes={8}
        colors={[ART.trainA, ART.trainB]}
      />
      {/* cones and players in a drill */}
      {[0, 1, 2, 3, 4].map((i) => (
        <polygon
          key={`cone-${i}`}
          points={pts(
            [378 + i * 13, 150 + i * 9, 0],
            [384 + i * 13, 150 + i * 9, 0],
            [381 + i * 13, 150 + i * 9, 7],
          )}
          fill={ART.cone}
        />
      ))}
      {(
        [
          [470, 140, 'var(--bulb)'],
          [492, 176, 'var(--chalk)'],
          [452, 200, 'var(--bulb)'],
          [420, 132, 'var(--chalk)'],
          [504, 214, 'var(--bulb)'],
        ] as const
      ).map(([x, y, color]) => (
        <g key={`${x}-${y}`}>
          <ellipse
            cx={isoX(x, y) + 2}
            cy={isoY(x, y)}
            rx={4.5}
            ry={2}
            opacity={0.4}
          />
          <line
            {...seg([x, y, 0], [x, y, 7])}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={isoX(x, y)} cy={isoY(x, y, 10)} r={2.2} fill="#e9c9a8" />
        </g>
      ))}
      <Flood x={342} y={108} h={52} small delay={0.5} />
      <Flood x={538} y={108} h={52} small delay={2} />
      <Flood x={342} y={240} h={52} small delay={3.2} />
    </g>
  );
}

function HeadquartersArt() {
  return (
    <g>
      <Flat x={48} y={378} w={96} d={96} fill="#000" opacity={0.4} />
      <Block
        x={40}
        y={370}
        w={90}
        d={90}
        h={12}
        top={ART.concreteTop}
        left={ART.concreteLeft}
        right={ART.concreteRight}
      />
      {/* glass tower */}
      <Block
        x={52}
        y={382}
        w={66}
        d={66}
        z={12}
        h={118}
        top={ART.glassTop}
        left={ART.glassLeft}
        right={ART.glassRight}
      />
      <Windows
        face="L"
        at={[55, 448]}
        len={60}
        cols={4}
        rows={8}
        z={30}
        h={8}
        gap={4.5}
        seed={2}
      />
      <Windows
        face="R"
        at={[118, 385]}
        len={60}
        cols={4}
        rows={8}
        z={30}
        h={8}
        gap={4.5}
        seed={5}
      />
      {/* lobby */}
      <polygon
        points={pts(
          [66, 448, 12],
          [104, 448, 12],
          [104, 448, 25],
          [66, 448, 25],
        )}
        fill={ART.windowWarm}
      />
      <polygon
        points={pts(
          [118, 396, 12],
          [118, 434, 12],
          [118, 434, 25],
          [118, 396, 25],
        )}
        fill={ART.windowWarm}
        opacity={0.7}
      />
      {/* gold thread on the corner and the crown */}
      <line
        {...seg([118, 448, 12], [118, 448, 130])}
        stroke="var(--bulb)"
        strokeWidth={1.6}
      />
      <polyline
        points={pts([52, 448, 130], [118, 448, 130], [118, 382, 130])}
        fill="none"
        stroke="var(--bulb)"
        strokeWidth={2}
      />
      <Block
        x={66}
        y={396}
        w={38}
        d={38}
        z={130}
        h={8}
        top={ART.wallTop}
        left={ART.wallLeft}
        right={ART.wallRight}
      />
      <line
        {...seg([85, 415, 138], [85, 415, 168])}
        stroke={ART.pole}
        strokeWidth={2}
      />
      <circle
        className="cm-blink"
        cx={isoX(85, 415)}
        cy={isoY(85, 415, 170)}
        r={3}
        fill={ART.red}
      />
    </g>
  );
}

function PressArt() {
  const dishX = isoX(192, 508);
  const dishY = isoY(192, 508, 46);
  const mastX = isoX(234, 498);
  const mastTop = isoY(234, 498, 88);
  return (
    <g>
      <Flat x={178} y={488} w={80} d={70} fill="#000" opacity={0.4} />
      <Block
        x={170}
        y={480}
        w={80}
        d={70}
        h={30}
        top={ART.wallTop}
        left={ART.wallLeft}
        right={ART.wallRight}
      />
      {/* studio window and newsroom */}
      <polygon
        points={pts(
          [178, 550, 8],
          [226, 550, 8],
          [226, 550, 22],
          [178, 550, 22],
        )}
        fill={ART.windowCool}
      />
      <polygon
        points={pts(
          [232, 550, 0],
          [244, 550, 0],
          [244, 550, 18],
          [232, 550, 18],
        )}
        fill={ART.windowWarm}
      />
      <Windows
        face="R"
        at={[250, 486]}
        len={58}
        cols={3}
        z={9}
        h={11}
        seed={3}
      />
      <line
        {...seg([170, 550, 30], [250, 550, 30])}
        stroke="var(--bulb)"
        strokeWidth={1.6}
      />
      <line
        className="cm-blink"
        {...seg([180, 550, 25.5], [202, 550, 25.5])}
        stroke={ART.red}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {/* satellite dish */}
      <line
        {...seg([192, 508, 30], [192, 508, 44])}
        stroke={ART.pole}
        strokeWidth={3}
      />
      <ellipse
        cx={dishX}
        cy={dishY}
        rx={17}
        ry={11}
        fill={ART.steel}
        transform={`rotate(-28 ${dishX} ${dishY})`}
      />
      <ellipse
        cx={dishX + 1.5}
        cy={dishY - 1.5}
        rx={12}
        ry={7}
        fill={ART.pole}
        transform={`rotate(-28 ${dishX} ${dishY})`}
      />
      <line
        x1={dishX}
        y1={dishY}
        x2={dishX + 12}
        y2={dishY - 14}
        stroke={ART.steel}
        strokeWidth={1.6}
      />
      {/* broadcast mast */}
      <line
        x1={mastX}
        y1={isoY(234, 498, 30)}
        x2={mastX}
        y2={mastTop}
        stroke={ART.pole}
        strokeWidth={2.4}
      />
      <line
        x1={mastX - 7}
        y1={mastTop + 18}
        x2={mastX + 7}
        y2={mastTop + 18}
        stroke={ART.pole}
        strokeWidth={1.6}
      />
      <line
        x1={mastX - 5}
        y1={mastTop + 32}
        x2={mastX + 5}
        y2={mastTop + 32}
        stroke={ART.pole}
        strokeWidth={1.6}
      />
      <g
        className="cm-pulse"
        fill="none"
        stroke="var(--bulb)"
        strokeWidth={1.6}
        strokeLinecap="round"
        pointerEvents="none"
      >
        <path d={`M${mastX + 8} ${mastTop - 8} a11 11 0 0 1 0 16`} />
        <path
          d={`M${mastX + 15} ${mastTop - 14} a20 20 0 0 1 0 28`}
          opacity={0.6}
        />
        <path d={`M${mastX - 8} ${mastTop - 8} a11 11 0 0 0 0 16`} />
        <path
          d={`M${mastX - 15} ${mastTop - 14} a20 20 0 0 0 0 28`}
          opacity={0.6}
        />
      </g>
      <circle
        className="cm-blink"
        cx={mastX}
        cy={mastTop}
        r={3}
        fill={ART.red}
      />
    </g>
  );
}

const CARS: readonly (readonly [number, number, string])[] = [
  [366, 338, '#c2413b'],
  [414, 338, '#3d8fc4'],
  [438, 338, '#d9dee6'],
  [486, 338, '#d7a92f'],
  [462, 402, '#566277'],
  [510, 402, '#c2413b'],
];

function ParkingArt() {
  const signX = isoX(346, 436);
  const signY = isoY(346, 436, 46);
  return (
    <g>
      <Block
        x={340}
        y={330}
        w={210}
        d={110}
        h={2}
        top={ART.lot}
        left={ART.concreteLeft}
        right={ART.concreteRight}
      />
      {/* bays */}
      <g stroke="var(--chalk)" strokeOpacity={0.32} strokeWidth={1.2}>
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={`a${i}`}
            {...seg([360 + i * 24, 336, 2], [360 + i * 24, 368, 2])}
          />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={`b${i}`}
            {...seg([432 + i * 24, 400, 2], [432 + i * 24, 432, 2])}
          />
        ))}
      </g>
      {CARS.slice(0, 4).map(([x, y, color]) => (
        <ParkedCar key={`${x}-${y}`} x={x} y={y} color={color} />
      ))}
      {/* team bus: where the signings arrive */}
      <Flat x={362} y={408} w={62} d={20} fill="#000" opacity={0.4} />
      <Block
        x={356}
        y={402}
        w={62}
        d={20}
        z={2}
        h={18}
        top={ART.wallTop}
        left={ART.wallLeft}
        right={ART.wallRight}
      />
      <Windows
        face="L"
        at={[358, 422]}
        len={58}
        cols={6}
        z={11}
        h={6}
        seed={1}
      />
      <polygon
        points={pts(
          [418, 404, 9],
          [418, 420, 9],
          [418, 420, 17],
          [418, 404, 17],
        )}
        fill={ART.windowCool}
        opacity={0.8}
      />
      <line
        {...seg([356, 422, 7.5], [418, 422, 7.5])}
        stroke="var(--bulb)"
        strokeWidth={2}
      />
      {CARS.slice(4).map(([x, y, color]) => (
        <ParkedCar key={`${x}-${y}`} x={x} y={y} color={color} />
      ))}
      {/* gate booth and barrier */}
      <Block
        x={530}
        y={372}
        w={14}
        d={14}
        z={2}
        h={16}
        top={ART.roofTop}
        left={ART.wallLeft}
        right={ART.wallRight}
      />
      <polygon
        points={pts(
          [532, 386, 9],
          [542, 386, 9],
          [542, 386, 15],
          [532, 386, 15],
        )}
        fill={ART.windowWarm}
      />
      <line
        {...seg([548, 392, 9], [548, 432, 9])}
        stroke={ART.red}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {/* transfer market sign */}
      <line
        x1={signX}
        y1={isoY(346, 436, 2)}
        x2={signX}
        y2={signY}
        stroke={ART.pole}
        strokeWidth={2.4}
      />
      <rect
        x={signX - 19}
        y={signY - 24}
        width={38}
        height={24}
        rx={4}
        fill="var(--board)"
        stroke="var(--bulb)"
        strokeWidth={1.4}
      />
      <g
        fill="none"
        stroke="var(--bulb)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={`M${signX - 11} ${signY - 16} h20 m-5 -4 l5 4 l-5 4`} />
        <path
          d={`M${signX + 11} ${signY - 8} h-20 m5 -4 l-5 4 l5 4`}
          stroke="var(--grass-light, #4be08f)"
        />
      </g>
    </g>
  );
}

function HomeArt() {
  return (
    <g>
      {/* garden */}
      <Flat x={386} y={478} w={88} d={76} fill={ART.grassEdge} />
      <Flat x={402} y={492} w={68} d={54} fill="#000" opacity={0.4} />
      <Block
        x={396}
        y={486}
        w={66}
        d={52}
        h={22}
        top={ART.tileDeep}
        left="#3b4656"
        right="#2a3340"
      />
      {/* gable roof: ridge along x */}
      <polygon
        points={pts([462, 486, 22], [462, 538, 22], [462, 512, 41])}
        fill="#2a3340"
      />
      <polygon
        points={pts(
          [392, 542, 19],
          [466, 542, 19],
          [466, 512, 42],
          [392, 512, 42],
        )}
        fill={ART.tile}
      />
      <line
        {...seg([392, 512, 42], [466, 512, 42])}
        stroke={ART.tileDeep}
        strokeWidth={2}
      />
      <Block
        x={440}
        y={498}
        w={7}
        d={7}
        z={36}
        h={16}
        top={ART.concreteTop}
        left={ART.concreteLeft}
        right={ART.concreteRight}
      />
      {/* door and warm windows */}
      <polygon
        points={pts(
          [424, 538, 0],
          [435, 538, 0],
          [435, 538, 14],
          [424, 538, 14],
        )}
        fill={ART.trunk}
      />
      <polygon
        points={pts(
          [403, 538, 6],
          [417, 538, 6],
          [417, 538, 15],
          [403, 538, 15],
        )}
        fill={ART.windowWarm}
      />
      <polygon
        points={pts(
          [442, 538, 6],
          [456, 538, 6],
          [456, 538, 15],
          [442, 538, 15],
        )}
        fill={ART.windowWarm}
        className="cm-twinkle"
        style={{ animationDuration: '9s' }}
      />
      <polygon
        points={pts(
          [462, 496, 6],
          [462, 510, 6],
          [462, 510, 15],
          [462, 496, 15],
        )}
        fill={ART.windowWarm}
        opacity={0.75}
      />
      {/* path to the street and a trophy by the door */}
      <Flat x={425} y={541} w={9} d={5} fill={ART.concreteTop} />
      <Flat x={425} y={548} w={9} d={5} fill={ART.concreteTop} />
      <circle
        cx={isoX(429.5, 538)}
        cy={isoY(429.5, 538, 19)}
        r={7}
        fill="url(#cm-warm)"
      />
      <circle
        cx={isoX(429.5, 538)}
        cy={isoY(429.5, 538, 19)}
        r={2.2}
        fill="var(--bulb)"
      />
      <Tree x={398} y={548} size={0.7} />
    </g>
  );
}

function BuildingArt({ area }: { area: ClubArea }) {
  switch (area.id) {
    case 'ct':
      return <TrainingArt />;
    case 'stadium':
      return <StadiumArt />;
    case 'hq':
      return <HeadquartersArt />;
    case 'press':
      return <PressArt />;
    case 'parking':
      return <ParkingArt />;
    case 'home':
      return <HomeArt />;
    default:
      return null;
  }
}

/** Broadcast tag floating in front of the building. */
function Label({ area }: { area: ClubArea }) {
  const text = area.short ?? area.name;
  const [cx, cy] = area.label;
  const width = text.length * 12.5 + 30;
  return (
    <g aria-hidden="true" className="cm-label">
      <rect
        className="cm-label-bg"
        x={round(cx - width / 2)}
        y={cy - 13}
        width={width}
        height={26}
        rx={5}
      />
      <text
        className="cm-label-text font-display uppercase"
        x={cx}
        y={cy + 7}
        textAnchor="middle"
        fontSize={20}
        fontWeight={700}
        letterSpacing={1.6}
      >
        {text}
      </text>
    </g>
  );
}

function centerOf(node: Element): ScreenOrigin {
  const box = node.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function Building({
  area,
  onTap,
}: {
  area: ClubArea;
  onTap(tap: BuildingTap): void;
}) {
  const ref = useRef<SVGGElement>(null);
  const tapAt = (origin: ScreenOrigin) =>
    onTap({ area, origin, anchor: ref.current });
  const onClick = (event: MouseEvent<SVGGElement>) => {
    // Keyboard "clicks" carry no pointer position: use the building centre.
    const pointer = event.clientX || event.clientY;
    tapAt(
      pointer
        ? { x: event.clientX, y: event.clientY }
        : centerOf(event.currentTarget),
    );
  };
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      tapAt(centerOf(event.currentTarget));
    }
  };
  const descId = `area-${area.id}-desc`;
  const plot = plotPoints(area.plot, 6);
  return (
    <g
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={areaLabel(area)}
      aria-describedby={descId}
      aria-haspopup={area.links.length > 1 ? 'dialog' : undefined}
      className="map-building"
      data-area={area.id}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <title>{areaLabel(area)}</title>
      <desc id={descId}>{area.description}</desc>
      {/* The plot stays on the ground (hit area and glow) while the building
          rises above it; the focus ring is drawn last so nothing hides it. */}
      <polygon className="cm-plate" points={plot} />
      <g className="map-lift">
        <g className="cm-art">
          <BuildingArt area={area} />
        </g>
        <Label area={area} />
      </g>
      <polygon className="map-focus" points={plot} pointerEvents="none" />
    </g>
  );
}

const TREES: readonly (readonly [number, number, number?])[] = [
  [8, 14],
  [322, 16, 0.8],
  [322, 196],
  [562, 20],
  [562, 96, 0.8],
  [562, 180],
  [560, 250, 0.9],
  [16, 300, 0.8],
  [18, 480],
  [26, 552, 0.9],
  [92, 560],
  [150, 340, 0.9],
  [232, 344],
  [240, 430, 0.8],
  [330, 468],
  [338, 556, 0.9],
  [520, 492],
  [556, 536],
  [500, 556, 0.8],
  [560, 462, 0.8],
];

const LAMPS: readonly (readonly [number, number])[] = [
  [264, 264],
  [316, 264],
  [264, 316],
  [316, 316],
  [120, 316],
  [470, 264],
  [316, 120],
  [264, 470],
  [316, 520],
  [540, 316],
];

/** Sky, ground plate, roads, trees and street lights (decorative). */
function Scenery() {
  const g = GROUND;
  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect width={VIEW_W} height={VIEW_H} fill="url(#cm-sky)" />
      {Array.from({ length: 34 }, (_, i) => (
        <circle
          key={i}
          cx={(i * 197 + 40) % VIEW_W}
          cy={(i * 89 + 12) % 300}
          r={i % 5 === 0 ? 1.6 : 1}
          fill={ART.star}
          opacity={i % 3 === 0 ? 0.7 : 0.4}
          className={i % 4 === 0 ? 'cm-twinkle' : undefined}
          style={
            i % 4 === 0 ? { animationDelay: `${(i % 9) * 0.5}s` } : undefined
          }
        />
      ))}
      {/* broadcast contour around the plate */}
      <polygon
        points={pts([-34, -34], [g + 34, -34], [g + 34, g + 34], [-34, g + 34])}
        fill="none"
        stroke="var(--bulb)"
        strokeOpacity={0.16}
      />
      <polygon
        points={pts([-18, -18], [g + 18, -18], [g + 18, g + 18], [-18, g + 18])}
        fill="none"
        stroke="var(--chalk)"
        strokeOpacity={0.08}
      />
      {/* ground plate */}
      <polygon
        points={pts([0, g, 0], [g, g, 0], [g, g, -14], [0, g, -14])}
        fill={ART.earthLeft}
      />
      <polygon
        points={pts([g, 0, 0], [g, g, 0], [g, g, -14], [g, 0, -14])}
        fill={ART.earthRight}
      />
      <Flat x={0} y={0} w={g} d={g} fill={ART.grass} />
      <polygon
        points={pts([0, 0], [g, 0], [g, g], [0, g])}
        fill="none"
        stroke={ART.grassEdge}
        strokeWidth={2}
      />
      {/* roads crossing at the middle of the club */}
      <Flat x={0} y={270} w={g} d={40} fill={ART.road} />
      <Flat x={270} y={0} w={40} d={g} fill={ART.road} />
      <g
        stroke="var(--bulb)"
        strokeOpacity={0.5}
        strokeWidth={1.6}
        strokeDasharray="14 16"
      >
        <line {...seg([6, 290], [262, 290])} />
        <line {...seg([318, 290], [g - 6, 290])} />
        <line {...seg([290, 6], [290, 262])} />
        <line {...seg([290, 318], [290, g - 6])} />
      </g>
      {/* zebra crossings */}
      <g stroke="var(--chalk)" strokeOpacity={0.4} strokeWidth={3}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`z${i}`}
            {...seg([252, 274 + i * 8], [262, 274 + i * 8])}
          />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`w${i}`}
            {...seg([274 + i * 8, 318], [274 + i * 8, 328])}
          />
        ))}
      </g>
      {/* a car cruising down the avenue */}
      <g className="cm-drive">
        <polygon
          points={pts([172, 299], [222, 290], [222, 308], [172, 304])}
          fill="url(#cm-warm)"
          opacity={0.7}
        />
        <Block
          x={150}
          y={296}
          w={22}
          d={11}
          h={6}
          top="#d9dee6"
          left="#aeb6c2"
          right="#8690a0"
        />
        <Block
          x={155}
          y={297.5}
          w={11}
          d={8}
          z={6}
          h={4}
          top={ART.glassTop}
          left={ART.windowOff}
          right={ART.windowOff}
        />
      </g>
      {LAMPS.map(([x, y]) => (
        <Lamp key={`${x}-${y}`} x={x} y={y} />
      ))}
      {TREES.map(([x, y, size]) => (
        <Tree key={`${x}-${y}`} x={x} y={y} size={size ?? 1} />
      ))}
    </g>
  );
}

/** Isometric night view of the club (SVG). Every building is a button. */
function ClubScene({
  club,
  onBuilding,
}: {
  club: string;
  onBuilding(tap: BuildingTap): void;
}) {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="group"
      aria-label={`Mapa do ${club}`}
      className="cm-scene block h-auto w-full select-none"
    >
      <style>{SCENE_CSS}</style>
      <defs>
        <linearGradient id="cm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ART.skyTop} />
          <stop offset="1" stopColor={ART.skyBottom} />
        </linearGradient>
        <radialGradient id="cm-glow">
          <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#dbeaff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#dbeaff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cm-warm">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cm-spill">
          <stop offset="0" stopColor="#d6ffe6" stopOpacity="0.3" />
          <stop offset="0.55" stopColor="#7fe0a8" stopOpacity="0.1" />
          <stop offset="1" stopColor="#7fe0a8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cm-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Scenery />
      {CLUB_AREAS.map((area) => (
        <Building key={area.id} area={area} onTap={onBuilding} />
      ))}
    </svg>
  );
}
