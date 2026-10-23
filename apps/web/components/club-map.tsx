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
import { PixelBall } from '@/components/retro/sprites';
import { Button } from '@/components/ui/button';
import type { CareerView, Screen } from '@/lib/career-api';
import {
  setScreenOrigin,
  type ScreenOrigin,
} from '@/lib/retro/transition-origin';
import { useSound } from '@/lib/retro/use-sound';

/** Rectangle on the 160 × 120 pixel map: x, y, width, height. */
type Rect = readonly [x: number, y: number, w: number, h: number];

export interface ClubArea {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: typeof Barbell;
  /** First link is where the map building itself leads. */
  readonly links: readonly (readonly [Screen, string])[];
  /** Footprint of the building (hit area and focus ring). */
  readonly rect: Rect;
  /** Shorter text for the drawing, when the name does not fit. */
  readonly short?: string;
}

/** Buildings of the top-down pixel club, in focus order. */
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
    rect: [6, 6, 60, 44],
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
    rect: [86, 4, 68, 48],
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
    rect: [6, 70, 38, 44],
  },
  {
    id: 'press',
    name: 'Imprensa',
    description: 'Sala de imprensa: manchetes e repercussão.',
    icon: Megaphone,
    links: [['inbox', 'Notícias']],
    rect: [48, 72, 20, 24],
  },
  {
    id: 'parking',
    name: 'Estacionamento',
    description: 'Onde chegam e partem os reforços: mercado.',
    icon: Car,
    links: [['market', 'Mercado']],
    rect: [86, 70, 68, 18],
    short: 'Mercado',
  },
  {
    id: 'home',
    name: 'Casa do treinador',
    description: 'Sua carreira, temporadas e conquistas.',
    icon: HouseLine,
    links: [['history', 'Carreira e histórico']],
    rect: [100, 94, 26, 20],
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

/** Mapa do clube: top-down pixel illustration; every building is a button. */
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
          <h2 id="mapa-ilustrado" className="font-pixel text-[.65rem]">
            Seu clube
          </h2>
          <span className="border-2 border-ink bg-bulb px-2 py-1 font-pixel text-[.5rem]">
            Toque num prédio
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada prédio abre uma tela do clube.
        </p>
        <nav
          aria-label="Áreas do mapa"
          className="px-border relative mt-3 bg-grass-deep sm:mx-auto sm:max-w-2xl"
        >
          <PixelClub club={career.club} onBuilding={onBuilding} />
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
          <span className="led block text-[.5rem] tracking-[.2em]">
            Próximo jogo
          </span>
          <strong className="block truncate font-pixel text-[.65rem] leading-relaxed sm:text-xs">
            {career.club} × {career.opponent.club}
          </strong>
        </p>
      </div>
      {career.fixture && (
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:flex">
          <button
            type="button"
            className="btn-px btn-play flex min-h-11 min-w-0 items-center justify-center gap-1 px-1.5 text-[.5rem] leading-tight break-words whitespace-normal sm:px-4 sm:text-[.65rem]"
            onClick={onNarrate}
          >
            <PixelBall size={14} />
            Jogar partida
          </button>
          <Button
            variant="outline"
            className="h-auto min-h-11 min-w-0 gap-1 px-1.5 text-[.5rem] leading-tight break-words whitespace-normal sm:px-4 sm:text-[.65rem]"
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
 * Small pixel sheet listing the screens of a building: anchored under the
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
  const anchorX = Math.min(66, Math.max(2, ((x + w / 2) / 160) * 100 - 16));
  const anchorY = Math.min(64, ((y + h) / 120) * 100 - 4);
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
            className="flex min-w-0 items-center gap-2 font-pixel text-[.6rem] leading-relaxed"
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

// --- pixel drawing (top-down, 160 × 120) -------------------------------------

/*
 * Illustration palette: artwork colors, not UI tokens. Everything is drawn
 * with axis-aligned rects on a 2px grid and crisp edges.
 */
const ART = {
  grassA: '#3a9447',
  grassB: '#2f7d3a',
  grassDeep: '#246630',
  chalk: '#f4efe2',
  ink: '#15201a',
  road: '#5a5e63',
  roadLine: '#d8d2c0',
  stand: '#8f949b',
  standDeep: '#6b7078',
  wallA: '#e6dcc3',
  wallB: '#c9b995',
  roof: '#c8322b',
  roofDeep: '#8f1f1a',
  window: '#7cc4ea',
  wood: '#a0672f',
  woodDeep: '#6b4119',
  bulb: '#ffd23f',
  carA: '#c8322b',
  carB: '#7cc4ea',
  carC: '#ffd23f',
  leaf: '#1f5a2a',
  leafLight: '#2f7d3a',
} as const;

function Px({
  x,
  y,
  w,
  h,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}) {
  return <rect x={x} y={y} width={w} height={h} fill={fill} />;
}

/** Outlined box with a 2px ink border. */
function Box({ rect: [x, y, w, h], fill }: { rect: Rect; fill: string }) {
  return (
    <>
      <Px x={x} y={y} w={w} h={h} fill={ART.ink} />
      <Px x={x + 2} y={y + 2} w={w - 4} h={h - 4} fill={fill} />
    </>
  );
}

/** Chalk pitch lines inside a rect. */
function PitchLines({ rect: [x, y, w, h] }: { rect: Rect }) {
  const midX = x + Math.floor(w / 2 / 2) * 2;
  return (
    <g fill={ART.chalk}>
      <Px x={x} y={y} w={w} h={2} fill={ART.chalk} />
      <Px x={x} y={y + h - 2} w={w} h={2} fill={ART.chalk} />
      <Px x={x} y={y} w={2} h={h} fill={ART.chalk} />
      <Px x={x + w - 2} y={y} w={2} h={h} fill={ART.chalk} />
      <Px x={midX} y={y} w={2} h={h} fill={ART.chalk} />
      <Px x={x} y={y + 8} w={8} h={2} fill={ART.chalk} />
      <Px x={x} y={y + h - 10} w={8} h={2} fill={ART.chalk} />
      <Px x={x + 8} y={y + 8} w={2} h={h - 16} fill={ART.chalk} />
      <Px x={x + w - 8} y={y + 8} w={8} h={2} fill={ART.chalk} />
      <Px x={x + w - 8} y={y + h - 10} w={8} h={2} fill={ART.chalk} />
      <Px x={x + w - 10} y={y + 8} w={2} h={h - 16} fill={ART.chalk} />
      <Px x={midX - 2} y={y + h / 2 - 2} w={6} h={4} fill={ART.chalk} />
    </g>
  );
}

function Tree({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden="true">
      <Px x={x + 2} y={y + 6} w={2} h={4} fill={ART.woodDeep} />
      <Px x={x} y={y} w={6} h={6} fill={ART.leaf} />
      <Px x={x + 1} y={y + 1} w={2} h={2} fill={ART.leafLight} />
    </g>
  );
}

function BuildingArt({ area }: { area: ClubArea }) {
  const [x, y, w, h] = area.rect;
  switch (area.id) {
    case 'ct':
      return (
        <g>
          <Box rect={area.rect} fill={ART.grassDeep} />
          <PitchLines rect={[x + 6, y + 8, w - 12, h - 14]} />
          {/* cones */}
          <Px x={x + 4} y={y + 4} w={2} h={2} fill={ART.bulb} />
          <Px x={x + 10} y={y + 4} w={2} h={2} fill={ART.bulb} />
          <Px x={x + 16} y={y + 4} w={2} h={2} fill={ART.bulb} />
        </g>
      );
    case 'stadium':
      return (
        <g>
          <Box rect={area.rect} fill={ART.stand} />
          {/* stand rows */}
          <Px x={x + 2} y={y + 2} w={w - 4} h={2} fill={ART.standDeep} />
          <Px x={x + 2} y={y + h - 4} w={w - 4} h={2} fill={ART.standDeep} />
          <Px x={x + 2} y={y + 2} w={2} h={h - 4} fill={ART.standDeep} />
          <Px x={x + w - 4} y={y + 2} w={2} h={h - 4} fill={ART.standDeep} />
          <Px x={x + 8} y={y + 8} w={w - 16} h={h - 16} fill={ART.grassB} />
          <Px x={x + 8} y={y + 8} w={w - 16} h={4} fill={ART.grassA} />
          <Px x={x + 8} y={y + 16} w={w - 16} h={4} fill={ART.grassA} />
          <Px x={x + 8} y={y + 24} w={w - 16} h={4} fill={ART.grassA} />
          <PitchLines rect={[x + 10, y + 10, w - 20, h - 20]} />
          {/* floodlights */}
          <Px x={x - 2} y={y - 2} w={4} h={4} fill={ART.bulb} />
          <Px x={x + w - 2} y={y - 2} w={4} h={4} fill={ART.bulb} />
          <Px x={x - 2} y={y + h - 2} w={4} h={4} fill={ART.bulb} />
          <Px x={x + w - 2} y={y + h - 2} w={4} h={4} fill={ART.bulb} />
        </g>
      );
    case 'hq':
      return (
        <g>
          <Box rect={area.rect} fill={ART.wallA} />
          <Px x={x + 2} y={y + 2} w={w - 4} h={6} fill={ART.wallB} />
          {[0, 1, 2, 3].map((row) =>
            [0, 1, 2].map((col) => (
              <Px
                key={`${row}-${col}`}
                x={x + 6 + col * 10}
                y={y + 12 + row * 8}
                w={6}
                h={4}
                fill={ART.window}
              />
            )),
          )}
          <Px x={x + w / 2 - 3} y={y + h - 8} w={6} h={6} fill={ART.woodDeep} />
        </g>
      );
    case 'press':
      return (
        <g>
          <Box rect={area.rect} fill={ART.wallB} />
          <Px x={x + 4} y={y + 6} w={4} h={4} fill={ART.window} />
          <Px x={x + 12} y={y + 6} w={4} h={4} fill={ART.window} />
          <Px x={x + 8} y={y + h - 8} w={4} h={6} fill={ART.woodDeep} />
          {/* antenna */}
          <Px x={x + w - 6} y={y - 10} w={2} h={12} fill={ART.ink} />
          <Px x={x + w - 8} y={y - 12} w={6} h={2} fill={ART.roof} />
        </g>
      );
    case 'parking':
      return (
        <g>
          <Box rect={area.rect} fill={ART.road} />
          {[0, 1, 2, 3, 4, 5].map((slot) => (
            <Px
              key={slot}
              x={x + 6 + slot * 10}
              y={y + 4}
              w={2}
              h={h - 8}
              fill={ART.roadLine}
            />
          ))}
          <Px x={x + 10} y={y + 6} w={6} h={8} fill={ART.carA} />
          <Px x={x + 30} y={y + 6} w={6} h={8} fill={ART.carB} />
          <Px x={x + 50} y={y + 6} w={6} h={8} fill={ART.carC} />
        </g>
      );
    case 'home':
      return (
        <g>
          <Box rect={[x, y + 8, w, h - 8]} fill={ART.wallA} />
          {/* stepped roof */}
          <Px x={x + 2} y={y + 6} w={w - 4} h={2} fill={ART.roofDeep} />
          <Px x={x + 4} y={y + 2} w={w - 8} h={4} fill={ART.roof} />
          <Px x={x + 8} y={y} w={w - 16} h={2} fill={ART.roof} />
          <Px x={x + 4} y={y + 14} w={4} h={4} fill={ART.window} />
          <Px x={x + w - 8} y={y + 14} w={4} h={4} fill={ART.window} />
          <Px x={x + w / 2 - 2} y={y + h - 8} w={4} h={6} fill={ART.woodDeep} />
        </g>
      );
    default:
      return <Box rect={area.rect} fill={ART.wallA} />;
  }
}

function Label({ area }: { area: ClubArea }) {
  const text = area.short ?? area.name;
  const [x, y, w, h] = area.rect;
  const width = text.length * 5 + 6;
  const left = Math.max(2, Math.min(160 - width - 2, x + w / 2 - width / 2));
  const top = y + h - 10;
  return (
    <g aria-hidden="true">
      <rect
        x={left}
        y={top}
        width={width}
        height={9}
        fill={ART.ink}
        className="map-label-bg"
      />
      <text
        x={left + width / 2}
        y={top + 6.6}
        textAnchor="middle"
        fontSize={5}
        fontFamily="'Press Start 2P', monospace"
        fill={ART.bulb}
      >
        {text.toUpperCase()}
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
  const [x, y, w, h] = area.rect;
  const descId = `area-${area.id}-desc`;
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
      <g className="map-lift">
        <BuildingArt area={area} />
        <rect
          className="map-focus"
          x={x - 2}
          y={y - 2}
          width={w + 4}
          height={h + 4}
        />
        <Label area={area} />
      </g>
    </g>
  );
}

const TREES: readonly (readonly [number, number])[] = [
  [70, 36],
  [70, 44],
  [48, 100],
  [56, 104],
  [66, 100],
  [140, 100],
  [148, 106],
  [132, 110],
  [90, 110],
];

/** Top-down pixel club (SVG). Every building is a focusable button. */
function PixelClub({
  club,
  onBuilding,
}: {
  club: string;
  onBuilding(tap: BuildingTap): void;
}) {
  return (
    <svg
      viewBox="0 0 160 120"
      role="group"
      aria-label={`Mapa pixel do ${club}`}
      shapeRendering="crispEdges"
      className="pixelated block h-auto w-full select-none"
    >
      <g aria-hidden="true">
        {/* mowed grass */}
        {Array.from({ length: 15 }, (_, row) => (
          <Px
            key={row}
            x={0}
            y={row * 8}
            w={160}
            h={8}
            fill={row % 2 ? ART.grassB : ART.grassA}
          />
        ))}
        {/* roads */}
        <Px x={0} y={56} w={160} h={10} fill={ART.road} />
        <Px x={72} y={0} w={10} h={120} fill={ART.road} />
        {Array.from({ length: 10 }, (_, i) => (
          <Px
            key={`h${i}`}
            x={i * 16 + 2}
            y={60}
            w={8}
            h={2}
            fill={ART.roadLine}
          />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <Px
            key={`v${i}`}
            x={76}
            y={i * 16 + 2}
            w={2}
            h={8}
            fill={ART.roadLine}
          />
        ))}
        {TREES.map(([x, y]) => (
          <Tree key={`${x}-${y}`} x={x} y={y} />
        ))}
      </g>
      {CLUB_AREAS.map((area) => (
        <Building key={area.id} area={area} onTap={onBuilding} />
      ))}
    </svg>
  );
}
