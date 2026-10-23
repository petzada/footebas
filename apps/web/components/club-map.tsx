'use client';

import type { KeyboardEvent } from 'react';
import {
  Barbell,
  Briefcase,
  Car,
  HouseLine,
  Lightning,
  Megaphone,
  Play,
  SoccerBall,
} from '@phosphor-icons/react';
import { ClubEmblem } from '@/components/club-emblem';
import { Button } from '@/components/ui/button';
import { Glass } from '@/components/ui/glass';
import type { CareerView, Screen } from '@/lib/career-api';

/** Isometric block on the club grid (10 × 10 tiles): x, y, width, depth, height. */
type Block = readonly [x: number, y: number, w: number, d: number, h: number];

export interface ClubArea {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: typeof Barbell;
  /** First link is where the map building itself leads. */
  readonly links: readonly (readonly [Screen, string])[];
  /** Main block of the building and the anchor of its label. */
  readonly block: Block;
  readonly label: readonly [x: number, y: number, z: number];
  /** Shorter text for the drawing, when the name does not fit. */
  readonly short?: string;
}

/** Buildings of the isometric club illustration, in focus order. */
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
    block: [0.6, 0.6, 3.4, 3.4, 0.25],
    label: [2.3, 2.3, 0.6],
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
    block: [6, 0.6, 3.4, 3.4, 1.6],
    label: [7.7, 2.3, 2.2],
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
    block: [0.8, 6, 2.8, 3, 2.6],
    label: [2.2, 7.5, 3],
  },
  {
    id: 'press',
    name: 'Imprensa',
    description: 'Sala de imprensa: manchetes e repercussão.',
    icon: Megaphone,
    links: [['inbox', 'Notícias']],
    block: [5.6, 5.8, 1.8, 1.6, 1.2],
    label: [6.5, 6.6, 2.3],
  },
  {
    id: 'parking',
    name: 'Estacionamento',
    description: 'Onde chegam e partem os reforços: mercado.',
    icon: Car,
    links: [['market', 'Mercado']],
    block: [5.8, 8.4, 3.6, 1.3, 0.05],
    label: [7.4, 9.2, 0.2],
  },
  {
    id: 'home',
    name: 'Casa do treinador',
    description: 'Sua carreira, temporadas e conquistas.',
    icon: HouseLine,
    links: [['history', 'Carreira e histórico']],
    block: [8.1, 5.6, 1.4, 1.6, 0.9],
    label: [8.8, 6.4, 1.9],
    short: 'Casa',
  },
];

export function areaLabel(area: ClubArea): string {
  return `${area.name}: ${area.links.map(([, label]) => label).join(' e ')}`;
}

/** Mapa do clube: isometric clickable illustration plus an equivalent list. */
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
  return (
    <div className="grid gap-4">
      <AdvanceBar career={career} onNarrate={onNarrate} onInstant={onInstant} />
      <Glass
        as="section"
        aria-labelledby="mapa-ilustrado"
        className="p-3 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mapa-ilustrado" className="text-lg font-extrabold">
            Seu clube
          </h2>
          <span className="rounded-full border border-glass-line bg-popover/80 px-3 py-1 text-xs font-bold">
            Toque num prédio
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada prédio abre uma tela. A lista logo abaixo tem os mesmos caminhos.
        </p>
        <nav
          aria-label="Áreas do mapa"
          className="-mx-2 mt-2 sm:mx-auto sm:max-w-2xl"
        >
          <IsometricClub club={career.club} navigate={navigate} />
        </nav>
      </Glass>
      <AreaList navigate={navigate} />
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
    <Glass
      as="section"
      strong
      aria-label="Avançar no calendário"
      className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ClubEmblem name={career.opponent.club} size={40} decorative />
        <p className="min-w-0 text-sm">
          <span className="block text-[.65rem] font-bold uppercase tracking-wider text-primary">
            Próximo jogo
          </span>
          <strong className="block truncate text-lg font-extrabold">
            {career.club} × {career.opponent.club}
          </strong>
        </p>
      </div>
      {career.fixture && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            className="play-button flex min-h-11 items-center justify-center gap-2 whitespace-nowrap px-3 text-base font-extrabold sm:px-4"
            onClick={onNarrate}
          >
            <Play weight="fill" aria-hidden="true" />
            Jogar partida
          </button>
          <Button
            variant="outline"
            className="h-auto min-h-11 whitespace-normal"
            onClick={onInstant}
          >
            <Lightning weight="fill" data-icon="inline-start" />
            Resultado instantâneo
          </Button>
        </div>
      )}
    </Glass>
  );
}

function AreaList({ navigate }: { navigate(value: Screen): void }) {
  return (
    <nav aria-label="Áreas do clube em lista">
      <h2 className="mb-2 text-lg font-extrabold">Ou escolha na lista</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CLUB_AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <li key={area.id} className="surface grid gap-2 rounded-2xl p-3">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <Icon
                    weight="duotone"
                    className="size-5"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3 className="text-base font-extrabold leading-tight">
                    {area.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {area.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {area.links.map(([screen, label]) => (
                  <Button
                    key={screen}
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => navigate(screen)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// --- isometric drawing -------------------------------------------------------

const ORIGIN_X = 140;
const ORIGIN_Y = 60;
const TILE = 15;

type Point = readonly [number, number];

/** Grid (x, y, z) to SVG coordinates (2:1 isometric). */
function project(x: number, y: number, z: number): Point {
  return [
    ORIGIN_X + (x - y) * TILE * 0.87,
    ORIGIN_Y + (x + y) * TILE * 0.5 - z * TILE,
  ];
}

const points = (list: readonly Point[]) =>
  list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/*
 * Illustration palette: the design.md pastels plus darker shades for the
 * isometric side faces. Artwork colors, not UI tokens.
 */
const SHADE = {
  grass: ['#57c285', '#3e9e67', '#46ae73'],
  sky: ['#bee3f0', '#8fc3d8', '#a6d3e5'],
  sand: ['#fdf1e3', '#e9cfb2', '#f3dec5'],
  rose: ['#f9e2e7', '#e5bcc6', '#efcbd3'],
  mist: ['#e4eef7', '#bccadb', '#cfdbe9'],
  asphalt: ['#c9d3df', '#aeb9c7', '#bcc6d3'],
  coral: ['#ff9473', '#e8553a', '#f0603e'],
} as const;

type Shade = keyof typeof SHADE;

function Box({
  block: [x, y, w, d, h],
  shade,
}: {
  block: Block;
  shade: Shade;
}) {
  const [top, left, right] = SHADE[shade];
  return (
    <g>
      <polygon
        points={points([
          project(x, y + d, 0),
          project(x + w, y + d, 0),
          project(x + w, y + d, h),
          project(x, y + d, h),
        ])}
        fill={left}
      />
      <polygon
        points={points([
          project(x + w, y, 0),
          project(x + w, y + d, 0),
          project(x + w, y + d, h),
          project(x + w, y, h),
        ])}
        fill={right}
      />
      <polygon
        points={points([
          project(x, y, h),
          project(x + w, y, h),
          project(x + w, y + d, h),
          project(x, y + d, h),
        ])}
        fill={top}
      />
    </g>
  );
}

function Tile({
  x,
  y,
  w,
  d,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  fill: string;
}) {
  return (
    <polygon
      points={points([
        project(x, y, 0),
        project(x + w, y, 0),
        project(x + w, y + d, 0),
        project(x, y + d, 0),
      ])}
      fill={fill}
    />
  );
}

/** Outline of a block as seen on screen (focus and hover ring). */
function silhouette([x, y, w, d, h]: Block): string {
  return points([
    project(x, y, h),
    project(x + w, y, h),
    project(x + w, y, 0),
    project(x + w, y + d, 0),
    project(x, y + d, 0),
    project(x, y + d, h),
  ]);
}

function Label({ at, text }: { at: ClubArea['label']; text: string }) {
  const [cx, cy] = project(...at);
  const width = text.length * 5.6 + 14;
  return (
    <g aria-hidden="true">
      <rect
        className="iso-label-bg"
        x={cx - width / 2}
        y={cy - 23}
        width={width}
        height={17}
        rx={8.5}
        fill="#ffffff"
        fillOpacity={0.92}
        stroke="#ffffff"
      />
      <text
        x={cx}
        y={cy - 11.2}
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={800}
        fill="#17263a"
        fontFamily="system-ui, sans-serif"
      >
        {text}
      </text>
    </g>
  );
}

function BuildingDetails({ id }: { id: string }) {
  switch (id) {
    case 'ct': {
      // Pitch lines on the training ground.
      const z = 0.26;
      return (
        <g fill="none" stroke="#ffffff" strokeOpacity={0.85} strokeWidth={1}>
          <polygon
            points={points([
              project(0.85, 0.85, z),
              project(3.75, 0.85, z),
              project(3.75, 3.75, z),
              project(0.85, 3.75, z),
            ])}
          />
          <polyline
            points={points([project(2.3, 0.85, z), project(2.3, 3.75, z)])}
          />
        </g>
      );
    }
    case 'stadium':
      return (
        <g>
          <Box block={[6.35, 0.95, 2.7, 2.7, 1.62]} shade="grass" />
          <polyline
            points={points([
              project(7.7, 0.95, 1.63),
              project(7.7, 3.65, 1.63),
            ])}
            stroke="#ffffff"
            strokeOpacity={0.85}
            fill="none"
          />
        </g>
      );
    case 'hq':
      return (
        <g fill="#7ea6c4" fillOpacity={0.8}>
          {[0.6, 1.3, 2].map((z) =>
            [1.1, 1.9, 2.7].map((x) => (
              <polygon
                key={`${x}-${z}`}
                points={points([
                  project(x, 9, z),
                  project(x + 0.45, 9, z),
                  project(x + 0.45, 9, z + 0.35),
                  project(x, 9, z + 0.35),
                ])}
              />
            )),
          )}
        </g>
      );
    case 'press': {
      const [ax, ay] = project(6.9, 6.3, 1.2);
      return (
        <g stroke="#4a5b70" strokeWidth={1.5} fill="none">
          <line x1={ax} y1={ay} x2={ax} y2={ay - 14} />
          <circle cx={ax} cy={ay - 16} r={2.5} fill="#ff9473" stroke="none" />
        </g>
      );
    }
    case 'parking':
      return (
        <g>
          <Box block={[6.2, 8.65, 0.5, 0.8, 0.35]} shade="coral" />
          <Box block={[7.2, 8.65, 0.5, 0.8, 0.35]} shade="sky" />
          <Box block={[8.4, 8.65, 0.5, 0.8, 0.35]} shade="grass" />
        </g>
      );
    case 'home': {
      // Pyramid roof.
      const [x, y, w, d, h] = [8.1, 5.6, 1.4, 1.6, 0.9];
      const apex = project(x + w / 2, y + d / 2, h + 0.7);
      return (
        <g>
          <polygon
            points={points([
              project(x, y + d, h),
              project(x + w, y + d, h),
              apex,
            ])}
            fill="#e8553a"
          />
          <polygon
            points={points([
              project(x + w, y, h),
              project(x + w, y + d, h),
              apex,
            ])}
            fill="#f0603e"
          />
        </g>
      );
    }
    default:
      return null;
  }
}

const AREA_SHADE: Record<string, Shade> = {
  ct: 'grass',
  stadium: 'sky',
  hq: 'sand',
  press: 'rose',
  parking: 'asphalt',
  home: 'mist',
};

const TREES: readonly Point[] = [
  [4.6, 0.4],
  [5.3, 2.6],
  [0.4, 4.9],
  [3.9, 9.4],
  [9.6, 4.6],
  [5.2, 7.6],
];

function Tree({ at: [x, y] }: { at: Point }) {
  const [bx, by] = project(x, y, 0);
  return (
    <g aria-hidden="true">
      <rect x={bx - 1} y={by - 6} width={2} height={6} fill="#8d6e55" />
      <circle cx={bx} cy={by - 10} r={5.5} fill="#3e9e67" />
      <circle cx={bx - 1.5} cy={by - 12} r={3} fill="#57c285" />
    </g>
  );
}

function Building({
  area,
  navigate,
}: {
  area: ClubArea;
  navigate(value: Screen): void;
}) {
  const go = () => navigate(area.links[0]![0]);
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      go();
    }
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={areaLabel(area)}
      className="iso-building"
      data-area={area.id}
      onClick={go}
      onKeyDown={onKeyDown}
    >
      <title>{areaLabel(area)}</title>
      <g className="iso-lift">
        <Box block={area.block} shade={AREA_SHADE[area.id] ?? 'mist'} />
        <BuildingDetails id={area.id} />
        <polygon className="iso-focus" points={silhouette(area.block)} />
        <Label at={area.label} text={area.short ?? area.name} />
      </g>
    </g>
  );
}

/** Isometric club (SVG). Every building is a focusable button. */
function IsometricClub({
  club,
  navigate,
}: {
  club: string;
  navigate(value: Screen): void;
}) {
  return (
    <svg
      viewBox="0 30 280 196"
      role="group"
      aria-label={`Mapa isométrico do ${club}`}
      className="block h-auto w-full select-none"
    >
      <g aria-hidden="true">
        <g className="iso-float">
          <ellipse
            cx="46"
            cy="52"
            rx="18"
            ry="6"
            fill="#ffffff"
            opacity="0.8"
          />
          <ellipse
            cx="58"
            cy="48"
            rx="12"
            ry="6"
            fill="#ffffff"
            opacity="0.8"
          />
          <ellipse
            cx="236"
            cy="58"
            rx="16"
            ry="5"
            fill="#ffffff"
            opacity="0.7"
          />
        </g>
        <Tile x={-0.3} y={-0.3} w={10.6} d={10.6} fill="#ffffff" />
        <Tile x={0} y={0} w={10} d={10} fill="#dff3f1" />
        <Tile x={0.3} y={0.3} w={9.4} d={9.4} fill="#cdebe6" />
        <Tile x={4.5} y={0} w={1} d={10} fill="#f3e6d3" />
        <Tile x={0} y={4.5} w={10} d={1} fill="#f3e6d3" />
        {TREES.map((tree) => (
          <Tree key={tree.join('-')} at={tree} />
        ))}
      </g>
      {CLUB_AREAS.map((area) => (
        <Building key={area.id} area={area} navigate={navigate} />
      ))}
    </svg>
  );
}
