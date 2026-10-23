'use client';

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
import type { CareerView, Screen } from '@/lib/career-api';

type Box = readonly [x: number, y: number, width: number, height: number];

export interface ClubArea {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: typeof Barbell;
  /** First link is where the map area itself leads. */
  readonly links: readonly (readonly [Screen, string])[];
  readonly box: Box;
}

/** Areas of the top-down club illustration (viewBox 400 × 300). */
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
    box: [16, 14, 160, 104],
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
    box: [196, 74, 162, 130],
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
    box: [24, 134, 112, 74],
  },
  {
    id: 'press',
    name: 'Imprensa',
    description: 'Sala de imprensa: manchetes e repercussão.',
    icon: Megaphone,
    links: [['inbox', 'Notícias']],
    box: [290, 10, 100, 56],
  },
  {
    id: 'parking',
    name: 'Estacionamento',
    description: 'Onde chegam e partem os reforços: mercado.',
    icon: Car,
    links: [['market', 'Mercado']],
    box: [150, 226, 140, 64],
  },
  {
    id: 'home',
    name: 'Casa do treinador',
    description: 'Sua carreira, temporadas e conquistas.',
    icon: HouseLine,
    links: [['history', 'Carreira e histórico']],
    box: [300, 222, 92, 70],
  },
];

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

export function areaLabel(area: ClubArea): string {
  return `${area.name}: ${area.links.map(([, label]) => label).join(' e ')}`;
}

/** Mapa do clube: clickable illustration plus an equivalent list. */
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
    <div className="flex flex-col gap-4">
      <AdvanceBar career={career} onNarrate={onNarrate} onInstant={onInstant} />
      <section aria-labelledby="mapa-ilustrado" className="club-map">
        <h2 id="mapa-ilustrado" className="sr-only">
          Mapa ilustrado do clube
        </h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Toque numa área do clube para abrir a tela. A lista logo abaixo tem os
          mesmos caminhos.
        </p>
        <div className="relative mx-auto aspect-[4/3] w-full max-w-4xl overflow-hidden rounded-2xl border-2 border-primary/40 shadow-xl">
          <ClubIllustration club={career.club} />
          <nav aria-label="Áreas do mapa" className="absolute inset-0">
            <ul>
              {CLUB_AREAS.map((area) => {
                const [x, y, width, height] = area.box;
                const Icon = area.icon;
                return (
                  <li key={area.id}>
                    <button
                      type="button"
                      aria-label={areaLabel(area)}
                      className="club-map-area group absolute flex items-end justify-center rounded-xl border-2 border-transparent pb-1 transition-colors hover:border-white/70 hover:bg-white/10 focus-visible:bg-white/10"
                      style={{
                        left: pct(x, 400),
                        top: pct(y, 300),
                        width: pct(width, 400),
                        height: pct(height, 300),
                      }}
                      onClick={() => navigate(area.links[0]![0])}
                    >
                      <span
                        aria-hidden="true"
                        className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[.6rem] font-bold uppercase tracking-wide text-white shadow ring-1 ring-white/25 group-hover:bg-black/85 sm:px-3 sm:py-1 sm:text-xs"
                      >
                        <Icon weight="fill" className="size-3 sm:size-4" />
                        {area.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </section>
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
    <section
      aria-label="Avançar no calendário"
      className="arcade-panel flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-center gap-3">
        <ClubEmblem name={career.opponent.club} size={40} decorative />
        <p className="min-w-0 text-sm">
          <span className="block text-[.65rem] font-bold uppercase tracking-wider text-primary">
            Próximo jogo
          </span>
          <strong className="block truncate font-display text-lg uppercase">
            {career.club} × {career.opponent.club}
          </strong>
        </p>
      </div>
      {career.fixture && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            className="play-button flex min-h-11 items-center justify-center gap-2 whitespace-nowrap px-3 font-display text-base font-bold uppercase sm:px-4 sm:text-lg"
            onClick={onNarrate}
          >
            <Play weight="fill" aria-hidden="true" />
            Jogar partida
          </button>
          <Button
            variant="secondary"
            className="h-auto min-h-11 whitespace-normal"
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

function AreaList({ navigate }: { navigate(value: Screen): void }) {
  return (
    <nav aria-label="Áreas do clube em lista">
      <h2 className="mb-2 font-display text-xl font-bold uppercase">
        Áreas do clube
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CLUB_AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <li
              key={area.id}
              className="flex flex-col gap-2 rounded-xl border bg-card/70 p-3"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Icon
                    weight="duotone"
                    className="size-5"
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold uppercase leading-tight">
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

/** Decorative top-down drawing; every interactive part lives in HTML. */
function ClubIllustration({ club }: { club: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      className="absolute inset-0 size-full"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="map-grass"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <rect width="20" height="20" fill="#2f6b3a" />
          <rect width="10" height="20" fill="#2c6537" />
        </pattern>
        <pattern
          id="map-pitch"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <rect width="16" height="16" fill="#3f8f45" />
          <rect width="8" height="16" fill="#3a8740" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill="url(#map-grass)" />
      {/* roads */}
      <path
        d="M0 216 H400 M184 0 V300 M184 120 H290 V70"
        stroke="#3b3f45"
        strokeWidth="14"
        fill="none"
      />
      <path
        d="M0 216 H400 M184 0 V300"
        stroke="#e9e3c9"
        strokeWidth="1.2"
        strokeDasharray="8 8"
        fill="none"
      />
      {/* CT: two training pitches and a gym */}
      <rect x="22" y="20" width="148" height="92" rx="6" fill="#255a30" />
      <g stroke="#f4f1e4" strokeWidth="1.2" fill="url(#map-pitch)">
        <rect x="30" y="28" width="62" height="40" />
        <rect x="100" y="28" width="62" height="40" />
      </g>
      <g stroke="#f4f1e4" strokeWidth="1" fill="none">
        <line x1="61" y1="28" x2="61" y2="68" />
        <circle cx="61" cy="48" r="7" />
        <line x1="131" y1="28" x2="131" y2="68" />
        <circle cx="131" cy="48" r="7" />
      </g>
      <rect x="30" y="76" width="70" height="28" rx="3" fill="#c9c3b0" />
      <rect x="30" y="76" width="70" height="7" fill="#a49d88" />
      <rect x="108" y="78" width="54" height="24" rx="3" fill="#7d8b97" />
      {/* Stadium */}
      <ellipse cx="277" cy="139" rx="78" ry="62" fill="#9aa3ab" />
      <ellipse cx="277" cy="139" rx="68" ry="53" fill="#c2c8cd" />
      <ellipse cx="277" cy="139" rx="56" ry="42" fill="#59626b" />
      <rect
        x="241"
        y="114"
        width="72"
        height="50"
        fill="url(#map-pitch)"
        stroke="#f4f1e4"
        strokeWidth="1.2"
      />
      <g stroke="#f4f1e4" strokeWidth="1" fill="none">
        <line x1="277" y1="114" x2="277" y2="164" />
        <circle cx="277" cy="139" r="8" />
        <rect x="241" y="128" width="9" height="22" />
        <rect x="304" y="128" width="9" height="22" />
      </g>
      {/* HQ */}
      <rect x="30" y="140" width="100" height="62" rx="4" fill="#d9d2bc" />
      <rect x="30" y="140" width="100" height="14" fill="#b8ae92" />
      <rect x="70" y="170" width="20" height="32" fill="#8c7f5f" />
      <g fill="#7ea6c4">
        <rect x="40" y="162" width="14" height="10" />
        <rect x="106" y="162" width="14" height="10" />
      </g>
      {/* Press room with antenna */}
      <rect x="298" y="16" width="86" height="44" rx="4" fill="#cfc6ad" />
      <rect x="298" y="16" width="86" height="10" fill="#aa9f82" />
      <circle
        cx="368"
        cy="40"
        r="9"
        fill="none"
        stroke="#5e6670"
        strokeWidth="2"
      />
      <line
        x1="368"
        y1="40"
        x2="376"
        y2="30"
        stroke="#5e6670"
        strokeWidth="2"
      />
      {/* Parking */}
      <rect x="156" y="232" width="128" height="52" rx="4" fill="#4a4f56" />
      <g stroke="#e9e3c9" strokeWidth="1">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((slot) => (
          <line
            key={slot}
            x1={166 + slot * 15}
            y1="234"
            x2={166 + slot * 15}
            y2="252"
          />
        ))}
      </g>
      <g>
        <rect x="169" y="236" width="9" height="14" rx="2" fill="#d9483b" />
        <rect x="199" y="236" width="9" height="14" rx="2" fill="#f2c14e" />
        <rect x="244" y="236" width="9" height="14" rx="2" fill="#4e8fd9" />
        <rect x="214" y="264" width="14" height="9" rx="2" fill="#e8e8e8" />
      </g>
      {/* Coach house */}
      <rect x="310" y="232" width="74" height="50" rx="3" fill="#a5553f" />
      <path d="M310 257 H384" stroke="#7d3c2c" strokeWidth="2" />
      <rect x="318" y="268" width="16" height="10" fill="#7ea6c4" />
      <circle cx="372" cy="272" r="5" fill="#62b0d9" />
      {/* Trees */}
      <g fill="#1f4a28">
        {[
          [12, 128],
          [150, 140],
          [160, 196],
          [12, 290],
          [140, 292],
          [296, 210],
          [392, 210],
          [392, 100],
          [205, 30],
          [230, 52],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="7" />
        ))}
      </g>
      <text
        x="277"
        y="92"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill="#1e2a22"
        letterSpacing="1"
      >
        {club.toUpperCase()}
      </text>
    </svg>
  );
}
