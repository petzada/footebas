'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Brand } from '@/components/brand';
import {
  PixelArrow,
  PixelCard,
  PixelCoin,
  PixelHeart,
  PixelStar,
  PixelTrophy,
  PixelWhistle,
} from '@/components/retro/sprites';
import {
  FREE_ENTITLEMENTS,
  LICENSED_ENTITLEMENTS,
  formatCents,
} from '@/lib/account-product';
import { crestFor } from '@/lib/club-crests';

/*
 * Landing (docs/09 "Mapa de telas"): a public page that sells the game in its
 * own broadcast style (ADR 0018), desktop first. The hero picture is a stadium
 * at night drawn in CSS (landing.css); no 3D engine loads here. Facts come
 * from the codebase: the free and licensed entitlements (lib/account-product),
 * the default price (apps/api/src/billing/service.ts: R$ 29,90) and the
 * screens that exist.
 */

/** The game lives on its own host (next.config.ts); the landing on lp. */
const GAME_URL =
  process.env['NEXT_PUBLIC_GAME_URL'] ?? 'https://game.footebas.com.br/';

/** Default licence price; the checkout always shows the server's value. */
const LICENSE_PRICE_CENTS = 2990;

/** Footer text link with a 44px tall tap area (WCAG 2.5.5). */
const footerLink =
  'inline-flex min-h-11 items-center underline underline-offset-4';

const SERIE_A = [
  'club_flamengo',
  'club_palmeiras',
  'club_corinthians',
  'club_sao_paulo',
  'club_santos',
  'club_gremio',
  'club_internacional',
  'club_atletico_mineiro',
  'club_cruzeiro',
  'club_fluminense',
  'club_botafogo',
  'club_vasco' /* generic emblem fallback */,
  'club_bahia',
  'club_fortaleza',
  'club_vitoria',
  'club_red_bull_bragantino',
  'club_mirassol',
  'club_juventude',
  'club_ceara',
  'club_sport',
] as const;

const SERIE_BC = [
  'club_athletico_paranaense',
  'club_coritiba',
  'club_goias',
  'club_chapecoense',
  'club_avai',
  'club_criciuma',
  'club_cuiaba',
  'club_america_mineiro',
  'club_novorizontino',
  'club_ponte_preta',
  'club_guarani',
  'club_nautico',
  'club_paysandu',
  'club_londrina',
  'club_figueirense',
  'club_ferroviaria',
  'club_ituano',
  'club_caxias',
  'club_confianca',
  'club_floresta',
] as const;

const CLUB_NAMES: Record<string, string> = {
  club_flamengo: 'Flamengo',
  club_palmeiras: 'Palmeiras',
  club_corinthians: 'Corinthians',
  club_sao_paulo: 'São Paulo',
  club_santos: 'Santos',
  club_gremio: 'Grêmio',
  club_internacional: 'Internacional',
  club_atletico_mineiro: 'Atlético Mineiro',
  club_cruzeiro: 'Cruzeiro',
  club_fluminense: 'Fluminense',
  club_botafogo: 'Botafogo',
  club_vasco: 'Vasco',
  club_bahia: 'Bahia',
  club_fortaleza: 'Fortaleza',
  club_vitoria: 'Vitória',
  club_red_bull_bragantino: 'Bragantino',
  club_mirassol: 'Mirassol',
  club_juventude: 'Juventude',
  club_ceara: 'Ceará',
  club_sport: 'Sport',
  club_athletico_paranaense: 'Athletico-PR',
  club_coritiba: 'Coritiba',
  club_goias: 'Goiás',
  club_chapecoense: 'Chapecoense',
  club_avai: 'Avaí',
  club_criciuma: 'Criciúma',
  club_cuiaba: 'Cuiabá',
  club_america_mineiro: 'América-MG',
  club_novorizontino: 'Novorizontino',
  club_ponte_preta: 'Ponte Preta',
  club_guarani: 'Guarani',
  club_nautico: 'Náutico',
  club_paysandu: 'Paysandu',
  club_londrina: 'Londrina',
  club_figueirense: 'Figueirense',
  club_ferroviaria: 'Ferroviária',
  club_ituano: 'Ituano',
  club_caxias: 'Caxias',
  club_confianca: 'Confiança',
  club_floresta: 'Floresta',
};

/** Club crest (pixel PNG from /public); clubs without one show initials. */
function Crest({
  id,
  size = 48,
  className = '',
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const src = crestFor('', id);
  const name = CLUB_NAMES[id] ?? id;
  if (!src) {
    return (
      <span
        role="img"
        aria-label={name}
        className={`px-border lp-display grid place-items-center bg-secondary text-[.74rem] text-chalk ${className}`}
        style={{ width: size, height: size }}
      >
        {name.slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return (
    // Static crest PNGs from /public: next/image would blur them and needs no
    // optimization here (same choice as club-emblem.tsx).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`pixelated object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Small check mark for lists. */
function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      className="lp-check"
      aria-hidden
      focusable="false"
    >
      <path
        d="M3 8.5 6.5 12 13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Adds data-in="true" to every .lp-reveal block when it scrolls into view. */
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const blocks = scope.querySelectorAll<HTMLElement>('.lp-reveal');
    if (typeof IntersectionObserver === 'undefined') {
      blocks.forEach((block) => (block.dataset['in'] = 'true'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Also reveal blocks already above the viewport (anchor jumps and
          // fast scrolls never intersect them).
          if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
            (entry.target as HTMLElement).dataset['in'] = 'true';
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    blocks.forEach((block) => observer.observe(block));
    return () => observer.disconnect();
  }, [root]);
}

/* ---------- Hero: a stadium at night with broadcast graphics ---------- */

interface Beat {
  readonly minute: number;
  readonly text: string;
  readonly home?: number;
  readonly away?: number;
  readonly tone?: 'goal' | 'card';
}

const DEMO_MATCH: readonly Beat[] = [
  { minute: 1, text: 'Bola rolando no Maracanã lotado.' },
  { minute: 12, text: 'Cruzamento da direita, zaga afasta.' },
  { minute: 23, text: 'GOL! Cabeçada no segundo pau.', home: 1, tone: 'goal' },
  { minute: 31, text: 'Falta dura no meio. Cartão amarelo.', tone: 'card' },
  { minute: 45, text: 'Intervalo. Você ajusta a tática.' },
  { minute: 58, text: 'Substituição: entra o garoto da base.' },
  {
    minute: 67,
    text: 'GOL! Contra-ataque em velocidade.',
    away: 1,
    tone: 'goal',
  },
  { minute: 79, text: 'Chute de fora, a bola raspa a trave.' },
  { minute: 88, text: 'GOL! O garoto decide.', home: 2, tone: 'goal' },
  { minute: 90, text: 'Fim de jogo. Três pontos e a torcida canta.' },
];

const HOME_ID = 'club_flamengo';
const AWAY_ID = 'club_palmeiras';

/** Athletes on the pitch plane: x%, y%, drift x, drift y (in cqw). */
const HOME_SPOTS = [
  [10, 46, 2.5, -0.8],
  [24, 22, 3.6, 1.2],
  [24, 70, 3.4, -1.5],
  [40, 36, 2.8, 1],
  [40, 62, 3.2, -1],
  [56, 48, 2.2, 1.8],
] as const;
const AWAY_SPOTS = [
  [90, 46, -2.2, 0.8],
  [76, 24, -3.4, 1.5],
  [76, 68, -3.2, -1.2],
  [62, 34, -2.8, -1],
  [62, 62, -3, 1.2],
  [47, 54, -2, -1.8],
] as const;

/** Words running on the LED boards around the pitch. */
const BOARD_WORDS = [
  'Footebas',
  'Série A',
  'Série B',
  'Série C',
  'Copa do Brasil',
  'Libertadores',
  'Ranking global',
] as const;

function shortName(id: string) {
  return (CLUB_NAMES[id] ?? id).slice(0, 3).toUpperCase();
}

function StadiumStage() {
  const [step, setStep] = useState(0);
  const beat = DEMO_MATCH[step] ?? DEMO_MATCH[0]!;
  const played = DEMO_MATCH.slice(0, step + 1);
  const home = played.reduce((score, b) => b.home ?? score, 0);
  const away = played.reduce((score, b) => b.away ?? score, 0);
  useEffect(() => {
    const id = window.setInterval(
      () => setStep((current) => (current + 1) % DEMO_MATCH.length),
      3200,
    );
    return () => window.clearInterval(id);
  }, []);
  const scorer =
    beat.tone === 'goal'
      ? CLUB_NAMES[beat.home !== undefined ? HOME_ID : AWAY_ID]
      : undefined;

  return (
    <figure className="lp-stage-glow lp-enter m-0 min-w-0">
      <div
        className="lp-stage stage-frame"
        role="img"
        aria-label="Demonstração de uma partida do Footebas: estádio à noite, gramado em 3D e placar de transmissão"
      >
        <div className="lp-sky" />
        {[10, 32, 68, 90].map((left, i) => (
          <span
            key={left}
            className="lp-flood"
            style={
              {
                left: `${left}%`,
                '--delay': `${i * -1.1}s`,
              } as React.CSSProperties
            }
          />
        ))}
        <div className="lp-stands" />
        <div className="lp-boards">
          <div className="lp-boards-track">
            {[
              ...BOARD_WORDS,
              ...BOARD_WORDS,
              ...BOARD_WORDS,
              ...BOARD_WORDS,
            ].map((word, i) => (
              <span key={i}>{word}</span>
            ))}
          </div>
        </div>
        <div className="lp-field">
          <div className="lp-pitch">
            {HOME_SPOTS.map(([x, y, dx, dy], i) => (
              <span
                key={`h${i}`}
                className="lp-player"
                style={
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    '--shirt': i % 2 ? '#d63a31' : '#1b1f27',
                    '--shorts': '#f1f4f8',
                    '--dx': `${dx}cqw`,
                    '--dy': `${dy}cqw`,
                    '--dur': `${2.6 + (i % 3) * 0.7}s`,
                    '--delay': `${i * -0.4}s`,
                  } as React.CSSProperties
                }
              >
                <i />
              </span>
            ))}
            {AWAY_SPOTS.map(([x, y, dx, dy], i) => (
              <span
                key={`a${i}`}
                className="lp-player"
                style={
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    '--shirt': '#1f9d55',
                    '--shorts': '#f1f4f8',
                    '--dx': `${dx}cqw`,
                    '--dy': `${dy}cqw`,
                    '--dur': `${2.8 + (i % 3) * 0.6}s`,
                    '--delay': `${i * -0.5}s`,
                  } as React.CSSProperties
                }
              >
                <i />
              </span>
            ))}
            <span className="lp-ball">
              <i />
            </span>
          </div>
        </div>
        <div className="lp-vignette" />

        <div className="lp-hud">
          <div className="lp-hud-top">
            <div className="hud-scorebug">
              <span>
                <span className="flex items-center gap-1.5">
                  <Crest id={HOME_ID} size={18} />
                  {shortName(HOME_ID)}
                </span>
              </span>
              <span className="hud-scorebug-score">
                <span className="flex items-center gap-1.5">
                  <span key={`h${home}`} className="lp-digit">
                    {home}
                  </span>
                  <span>–</span>
                  <span key={`a${away}`} className="lp-digit">
                    {away}
                  </span>
                </span>
              </span>
              <span>
                <span className="flex items-center gap-1.5">
                  {shortName(AWAY_ID)}
                  <Crest id={AWAY_ID} size={18} />
                </span>
              </span>
              <span className="hud-scorebug-clock">{beat.minute}&apos;</span>
            </div>
            <span className="hud-chip hud-chip-live">
              <span className="hud-dot" />
              Ao vivo
            </span>
          </div>
          {scorer && (
            <div key={step} className="lp-hud-goal">
              <div className="hud-goal">
                <span className="hud-goal-word">Gol!</span>
                <span className="hud-goal-team">{scorer}</span>
              </div>
            </div>
          )}
          <div className="lp-hud-caption">
            <p key={step} className="hud-caption hud-rise">
              {beat.tone === 'card' && <span className="hud-card" />}
              {beat.text}
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="hud-chip">0,5× · 1× · 2× · 4×</span>
        <span className="hud-chip">Pausa quando quiser</span>
        <span className="hud-chip">Tela cheia</span>
        <span
          className="hud-chip"
          style={
            { '--hud-accent': 'var(--grass-light)' } as React.CSSProperties
          }
        >
          Pular para o resultado
        </span>
      </figcaption>
    </figure>
  );
}

/* ---------- Sections ---------- */

/** Facts already stated on this page, as broadcast-style big numbers. */
const STATS = [
  { n: '3D', label: 'Partida ao vivo, em tempo real' },
  { n: '3', label: 'Divisões nacionais: Séries A, B e C' },
  { n: '2', label: 'Janelas de mercado por temporada' },
  { n: '4', label: 'Personalidades de treinador' },
  { n: 'R$ 0', label: 'Para jogar o jogo completo' },
] as const;

const LED_WORDS = [
  'Manager de futebol brasileiro',
  'Grátis',
  'Direto no navegador',
  'Partida 3D ao vivo',
  'Séries A, B e C com elencos de 2026',
  'Copa do Brasil',
  'Libertadores',
  'Ranking global',
] as const;

function LedBand() {
  return (
    <div className="lp-led">
      <p className="sr-only">{LED_WORDS.join(' · ')}</p>
      <div className="lp-led-track" aria-hidden>
        {[...LED_WORDS, ...LED_WORDS, ...LED_WORDS, ...LED_WORDS].map(
          (word, i) => (
            <span key={i}>{word}</span>
          ),
        )}
      </div>
    </div>
  );
}

function Marquee({ ids, dir }: { ids: readonly string[]; dir?: 'reverse' }) {
  const doubled = [...ids, ...ids];
  return (
    <div className="lp-marquee" data-dir={dir}>
      <div className="lp-marquee-track">
        {doubled.map((id, i) => (
          <span
            key={`${id}-${i}`}
            className="sticker flex w-28 shrink-0 flex-col items-center gap-2 px-2 py-3"
          >
            <Crest id={id} size={44} />
            <span className="lp-crest-name">{CLUB_NAMES[id] ?? id}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const BENEFITS: ReadonlyArray<{
  title: string;
  text: string;
  icon: ReactNode;
}> = [
  {
    title: 'Partida 3D ao vivo',
    text: 'Assista ao jogo em 3D, em tempo real, com placar de transmissão, narração, torcida e replay dos gols. Pause para mexer na tática, abra em tela cheia ou pule direto para o resultado.',
    icon: <PixelWhistle size={30} />,
  },
  {
    title: 'Campeonato Brasileiro',
    text: 'Séries A, B e C com acesso e rebaixamento, Copa do Brasil, estaduais e Libertadores com os gigantes do continente.',
    icon: <PixelTrophy size={30} />,
  },
  {
    title: 'Mercado com janelas',
    text: 'Duas janelas por temporada. Compre, venda, empreste e receba propostas da IA pelos seus craques.',
    icon: <PixelCoin size={30} />,
  },
  {
    title: 'Escritório de verdade',
    text: 'Negocie patrocínios, cuide do sócio-torcedor, feche contratos e segure o caixa no azul.',
    icon: <PixelCard size={30} />,
  },
  {
    title: 'Treinador com personalidade',
    text: 'Motivador, Disciplinador, Diplomata ou Estrategista: cada estilo muda o vestiário, a imprensa e o jogo.',
    icon: <PixelHeart size={30} />,
  },
  {
    title: 'Ranking global grátis',
    text: 'Suas conquistas validadas pelo servidor entram no ranking de treinadores. Sem pagar nada.',
    icon: <PixelStar size={30} />,
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Entre',
    text: 'Entre com Google ou e-mail. Sem cadastro longo para começar a jogar.',
  },
  {
    n: '02',
    title: 'Crie seu treinador',
    text: 'Nome, bandeira, avatar e a personalidade que vai guiar o clube.',
  },
  {
    n: '03',
    title: 'Escolha o clube',
    text: 'Todos os clubes das Séries A, B e C, com elenco de 2026 por posição.',
  },
  {
    n: '04',
    title: 'Avance rodadas',
    text: 'Escale, jogue, negocie e conquiste campeonatos. Salvo na nuvem, continue em qualquer aparelho.',
  },
] as const;

const SECTION = 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8';

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const title = 'FOOTEBAS';

  return (
    <div ref={root} className="lp-root min-h-dvh">
      {/* Header */}
      <header
        className={`${SECTION} flex items-center justify-between gap-3 pt-5`}
      >
        <Brand />
        <nav aria-label="Principal" className="flex items-center gap-6">
          <a href="#beneficios" className="lp-nav-link hidden md:inline">
            Recursos
          </a>
          <a href="#como" className="lp-nav-link hidden md:inline">
            Como funciona
          </a>
          <a href="#licenca" className="lp-nav-link hidden sm:inline">
            Licença
          </a>
          <a
            href={GAME_URL}
            className="btn-px btn-chalk inline-flex min-h-11 items-center px-5 text-base"
          >
            Entrar
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section
        className={`lp-hero ${SECTION} grid gap-10 pb-12 pt-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12 lg:pb-16 lg:pt-16`}
      >
        <div className="min-w-0">
          <p className="lp-kicker lp-enter">Sua carreira, sua história</p>
          <h1 className="lp-wordmark mt-4" aria-label={title}>
            {[...title].map((letter, i) => (
              <span
                key={i}
                aria-hidden
                style={{ '--i': i } as React.CSSProperties}
              >
                {letter}
              </span>
            ))}
          </h1>
          <p
            className="lp-headline lp-enter mt-5"
            style={{ '--delay': '0.35s' } as React.CSSProperties}
          >
            Assista às suas partidas <em>em 3D, em tempo real</em>, no navegador
          </p>
          <p
            className="lp-lead lp-enter mt-5"
            style={{ '--delay': '0.45s' } as React.CSSProperties}
          >
            O manager de futebol brasileiro para você escolher seu clube, montar
            o elenco, negociar no mercado e conquistar as Séries A, B e C, a
            Copa do Brasil e a Libertadores. Com ranking global de treinadores,
            e grátis.
          </p>
          <div
            className="lp-enter mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ '--delay': '0.55s' } as React.CSSProperties}
          >
            <a
              href={GAME_URL}
              className="play-button lp-cta inline-flex min-h-16 items-center justify-center gap-3 px-8"
            >
              <span className="lp-nudge inline-flex">
                <PixelArrow size={18} />
              </span>
              Começar carreira grátis
            </a>
            <a
              href="#licenca"
              className="btn-px btn-board lp-cta-secondary inline-flex min-h-14 items-center justify-center gap-2 px-6"
            >
              <PixelCoin size={18} />
              Ver a licença
            </a>
          </div>
          <ul
            className="lp-trust lp-enter mt-7"
            style={{ '--delay': '0.65s' } as React.CSSProperties}
          >
            {[
              'Sem instalar',
              'Sem assinatura',
              'Sem anúncios',
              'Sem pay-to-win',
            ].map((item) => (
              <li key={item}>
                <Check />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <StadiumStage />
      </section>

      <LedBand />

      {/* Numbers */}
      <section aria-label="O jogo em números" className={`${SECTION} pt-10`}>
        <ul className="lp-stats lp-reveal">
          {STATS.map((stat) => (
            <li key={stat.label}>
              <span className="lp-stat-n">{stat.n}</span>
              <span className="lp-stat-label">{stat.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Crest shelf */}
      <section
        aria-label="Clubes do jogo"
        className="flex flex-col gap-3 pb-4 pt-12"
      >
        <Marquee ids={SERIE_A} />
        <Marquee ids={SERIE_BC} dir="reverse" />
        <p className="lp-note px-4 pt-2 text-center">
          Todos os clubes das Séries A, B e C de 2026, mais os estrangeiros da
          Libertadores
        </p>
      </section>

      {/* Benefits */}
      <section
        aria-labelledby="beneficios"
        className={`${SECTION} scroll-mt-6 py-16`}
      >
        <div className="lp-reveal flex flex-col gap-4">
          <p className="lp-kicker">Recursos</p>
          <h2 id="beneficios" className="lp-h2">
            Por que jogar Footebas
          </h2>
          <p className="lp-lead">
            Um manager completo, não uma demo capada. Tudo abaixo está liberado
            no plano grátis.
          </p>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit, i) => (
            <li
              key={benefit.title}
              className="lp-reveal lp-card panel flex flex-col gap-4 p-6"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <span className="lp-card-index" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="lp-icon">{benefit.icon}</span>
              <h3 className="lp-h3">{benefit.title}</h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                {benefit.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Club life: a scoreboard of what you manage */}
      <section aria-labelledby="clube" className={`${SECTION} pb-16`}>
        <div className="lp-reveal panel-board grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="lp-kicker">Gestão</p>
            <h2 id="clube" className="lp-h2 mt-4">
              Seu clube, rodada a rodada
            </h2>
            <p className="lp-lead mt-4">
              Da Central você vê o próximo jogo, a tabela e a caixa de entrada
              com decisões que não esperam: proposta por um titular, patrocínio
              na mesa, o presidente cobrando acesso. No Mapa do clube, cada
              prédio abre uma tela: CT, estádio, sede e imprensa.
            </p>
            <ul className="mt-7 flex flex-col gap-4">
              {[
                ['Força do elenco', '72%', 'bulb'],
                ['Moral do vestiário', '84%', ''],
                ['Caixa do clube', '58%', ''],
                ['Entrosamento', '66%', 'bulb'],
              ].map(([label, w, tone]) => (
                <li key={label} className="flex flex-col gap-1.5">
                  <span className="lp-meter-label">
                    <span>{label}</span>
                    <span className="text-bulb">{w}</span>
                  </span>
                  <span
                    className="bar-px lp-bar"
                    data-tone={tone || undefined}
                    style={{ '--w': w } as React.CSSProperties}
                  >
                    <span />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-5">
            <table className="teletext lp-table w-full text-chalk">
              <caption>Série B · rodada 31</caption>
              <tbody>
                {[
                  ['1', 'club_coritiba', 'Coritiba', '61'],
                  ['2', 'club_goias', 'Goiás', '58'],
                  ['3', 'club_athletico_paranaense', 'Athletico-PR', '57'],
                  ['4', 'club_chapecoense', 'Chapecoense', '55'],
                  ['5', 'club_novorizontino', 'Novorizontino', '52'],
                ].map(([pos, id, name, pts]) => (
                  <tr key={id}>
                    <td className="w-8 text-muted-foreground">{pos}</td>
                    <td className="w-10">
                      <Crest id={id!} size={22} />
                    </td>
                    <td>{name}</td>
                    <td className="text-right text-lg text-bulb">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="lp-note">
              Quatro sobem. Você está no G4 e falta um jogo. Vai pular ou
              assistir ao vivo?
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="como"
        className={`${SECTION} scroll-mt-6 pb-16`}
      >
        <div className="lp-reveal flex flex-col gap-4">
          <p className="lp-kicker">Como funciona</p>
          <h2 id="como" className="lp-h2">
            Do login ao apito inicial
          </h2>
        </div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className="lp-reveal lp-card panel flex flex-col gap-3 p-6"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <span className="led lp-step-n">{step.n}</span>
              <h3 className="lp-h3">{step.title}</h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Licence */}
      <section
        id="licenca"
        aria-labelledby="licenca-titulo"
        className={`${SECTION} scroll-mt-6 pb-16`}
      >
        <div className="lp-reveal">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="lp-kicker">Planos</p>
            <p className="lp-h2">Comece grátis.</p>
            <p className="lp-lead">
              Você pode apoiar o jogo com a licença e recebe benefícios por
              isso.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div className="panel flex flex-col gap-5 p-6 sm:p-8">
              <h2 id="licenca-titulo" className="lp-h3">
                Grátis
              </h2>
              <p className="led lp-price lp-price-free">R$ 0</p>
              <ul className="lp-list text-card-foreground">
                {[
                  'Jogo completo',
                  `${String(FREE_ENTITLEMENTS.maxCareers)} carreira ativa`,
                  'Começa na Série C',
                  'Partidas ao vivo e ranking global',
                ].map((benefit) => (
                  <li key={benefit}>
                    <Check />
                    {benefit}
                  </li>
                ))}
              </ul>
              <a
                href={GAME_URL}
                className="btn-px btn-grass mt-auto inline-flex min-h-14 items-center justify-center px-5 text-lg"
              >
                Jogar de graça
              </a>
            </div>

            <div className="panel-board lp-featured flex flex-col gap-5 p-6 sm:p-8">
              <span className="lp-tag">
                <PixelCoin size={14} />
                Pagamento único
              </span>
              <div className="flex items-center gap-3">
                <PixelStar size={28} />
                <h2 className="lp-h3 text-bulb">Licença Footebas</h2>
              </div>
              <p className="led lp-price">{formatCents(LICENSE_PRICE_CENTS)}</p>
              <ul className="lp-list text-chalk">
                {[
                  'Jogo completo',
                  `Até ${String(LICENSED_ENTITLEMENTS.maxCareers)} carreiras ativas`,
                  'Começa no seu clube favorito',
                  'Sem assinatura',
                  'Reembolso integral em até 7 dias',
                ].map((benefit) => (
                  <li key={benefit}>
                    <PixelStar size={16} />
                    {benefit}
                  </li>
                ))}
              </ul>
              <a
                href={GAME_URL}
                className="play-button mt-auto inline-flex min-h-14 items-center justify-center gap-3 px-5 text-lg"
              >
                <PixelCoin size={18} />
                Quero meus benefícios
              </a>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ficou com dúvidas? Fale com o nosso suporte
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className={`${SECTION} pb-8`}>
        <div className="lp-reveal lp-final panel-board flex flex-col items-center gap-5 px-6 py-12 text-center sm:py-16">
          <div className="flex items-center gap-3">
            <Crest id="club_gremio" size={40} />
            <Crest id="club_corinthians" size={40} />
            <Crest id="club_bahia" size={40} />
            <Crest id="club_cruzeiro" size={40} />
            <Crest id="club_santos" size={40} />
          </div>
          <h2 className="lp-h2">Qual clube você vai levar ao título?</h2>
          <p className="lp-lead">
            A carreira começa em um minuto e fica salva na nuvem. Primeiro jogo
            hoje.
          </p>
          <a
            href={GAME_URL}
            className="play-button lp-cta inline-flex min-h-16 items-center justify-center gap-3 px-10"
          >
            <PixelArrow size={18} />
            Começar carreira
          </a>
        </div>
      </section>

      <p className="mx-auto max-w-2xl px-4 pb-8 text-center text-xs leading-relaxed text-muted-foreground sm:px-6">
        Escudos e nomes dos clubes pertencem aos seus donos e aparecem apenas
        para identificar as equipes do jogo.
      </p>

      <footer className={`${SECTION} pb-12`}>
        <div className="panel-wood lp-footer lp-display flex flex-col items-center gap-5 px-4 py-8 text-center text-sm text-chalk sm:py-10">
          <span className="text-xl">Footebas</span>
          <nav
            aria-label="Documentos legais"
            className="flex flex-wrap justify-center gap-x-8 gap-y-3"
          >
            <a className={footerLink} href="/termos">
              Termos de uso
            </a>
            <a className={footerLink} href="/privacidade">
              Privacidade
            </a>
            <a className={footerLink} href={GAME_URL}>
              Entrar no jogo
            </a>
          </nav>
          <span className="text-muted-foreground">Feito no Brasil</span>
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          Footebas é operado por Marct Soluções Digitais · CNPJ
          63.940.273/0001-36
        </p>
      </footer>
    </div>
  );
}
