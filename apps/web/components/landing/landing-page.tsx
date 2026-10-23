'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Brand } from '@/components/brand';
import {
  PixelArrow,
  PixelBall,
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
 * Landing arcade (docs/09 "Mapa de telas"): a public page that sells the game
 * in its own retro style (ADR 0012). Facts come from the codebase: the free
 * and licensed entitlements (lib/account-product), the default price
 * (apps/api/src/billing/service.ts: R$ 49,90) and the screens that exist.
 */

/** The game lives on its own host (next.config.ts); the landing on lp. */
const GAME_URL =
  process.env['NEXT_PUBLIC_GAME_URL'] ?? 'https://game.footebas.com.br/';

/** Default licence price; the checkout always shows the server's value. */
const LICENSE_PRICE_CENTS = 4990;

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

/** Pixel crest scaled with crisp edges; clubs without one show initials. */
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
        className={`px-border grid place-items-center bg-chalk font-pixel text-[.5rem] text-ink ${className}`}
        style={{ width: size, height: size }}
      >
        {name.slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return (
    // Static pixel PNGs from /public: next/image would blur them and needs no
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
          if (entry.isIntersecting) {
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

/* ---------- Hero: a live pixel match ---------- */

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
  { minute: 67, text: 'GOL! Contra-ataque em velocidade.', away: 1, tone: 'goal' },
  { minute: 79, text: 'Chute de fora, a bola raspa a trave.' },
  { minute: 88, text: 'GOL! O garoto decide.', home: 2, tone: 'goal' },
  { minute: 90, text: 'Fim de jogo. Três pontos e a torcida canta.' },
];

function LiveMatch() {
  const [step, setStep] = useState(0);
  const beat = DEMO_MATCH[step] ?? DEMO_MATCH[0]!;
  const home = DEMO_MATCH.slice(0, step + 1).reduce(
    (score, b) => b.home ?? score,
    0,
  );
  const away = DEMO_MATCH.slice(0, step + 1).reduce(
    (score, b) => b.away ?? score,
    0,
  );
  useEffect(() => {
    const id = window.setInterval(
      () => setStep((current) => (current + 1) % DEMO_MATCH.length),
      2600,
    );
    return () => window.clearInterval(id);
  }, []);
  const lines = DEMO_MATCH.slice(Math.max(0, step - 2), step + 1);

  return (
    <div
      className="panel-board relative overflow-hidden p-3 sm:p-4"
      aria-label="Demonstração de uma partida do Footebas"
    >
      <div className="lp-crowd" aria-hidden />
      <div className="lp-crowd" data-row="2" aria-hidden />
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-1">
          <Crest id="club_flamengo" size={56} />
          <span className="font-pixel text-[.5rem] text-chalk/80">
            Flamengo
          </span>
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-3xl sm:text-4xl">
            <span key={`h${home}`} className="led lp-digit">
              {home}
            </span>
            <span className="led text-xl">×</span>
            <span key={`a${away}`} className="led lp-digit">
              {away}
            </span>
          </div>
          <span className="font-pixel text-[.55rem] text-bulb">
            {beat.minute}&apos;
          </span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Crest id="club_palmeiras" size={56} />
          <span className="font-pixel text-[.5rem] text-chalk/80">
            Palmeiras
          </span>
        </div>
      </div>

      <div
        className="pitch relative mt-3 h-36 w-full overflow-hidden"
        style={{ outline: '2px solid rgb(244 239 226 / 0.6)' }}
        aria-hidden
      >
        <div className="lp-floodlight" />
        {[
          [10, 46, 20, -6],
          [24, 22, 30, 10],
          [24, 70, 28, -12],
          [40, 36, 22, 8],
          [40, 60, 26, -8],
          [56, 48, 18, 14],
        ].map(([x, y, dx, dy], i) => (
          <span
            key={`h${i}`}
            className="lp-player"
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                background: i % 2 ? '#c8322b' : '#15201a',
                '--shorts': '#f4efe2',
                '--dx': `${dx}px`,
                '--dy': `${dy}px`,
                '--dur': `${2.2 + (i % 3) * 0.6}s`,
                '--delay': `${i * -0.4}s`,
              } as React.CSSProperties
            }
          />
        ))}
        {[
          [88, 46, -18, 6],
          [74, 24, -28, 12],
          [74, 68, -26, -10],
          [60, 34, -22, -8],
          [60, 62, -24, 10],
          [46, 52, -16, -14],
        ].map(([x, y, dx, dy], i) => (
          <span
            key={`a${i}`}
            className="lp-player"
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                background: '#1f7a3a',
                '--shorts': '#f4efe2',
                '--dx': `${dx}px`,
                '--dy': `${dy}px`,
                '--dur': `${2.4 + (i % 3) * 0.5}s`,
                '--delay': `${i * -0.5}s`,
              } as React.CSSProperties
            }
          />
        ))}
        <span className="lp-ball" />
      </div>

      <ul className="match-feed mt-3 flex flex-col gap-1 text-[.55rem] leading-relaxed sm:text-[.6rem]">
        {lines.map((line) => (
          <li
            key={line.minute}
            className={`lp-line flex items-center gap-2 ${
              line.tone === 'goal' ? 'text-bulb' : 'text-chalk/85'
            }`}
          >
            <span className="w-7 shrink-0 text-chalk/60">{line.minute}&apos;</span>
            {line.tone === 'card' && <PixelCard size={12} />}
            {line.tone === 'goal' && <PixelBall size={12} />}
            <span className="truncate">{line.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-pixel text-[.5rem] text-chalk/70">
        <span>0,5× · 1× · 2× · 4×</span>
        <span>Pausa quando quiser</span>
        <span className="text-bulb">Pular para o resultado</span>
      </div>
    </div>
  );
}

/* ---------- Sections ---------- */

function Marquee({
  ids,
  dir,
}: {
  ids: readonly string[];
  dir?: 'reverse';
}) {
  const doubled = [...ids, ...ids];
  return (
    <div className="lp-marquee" data-dir={dir}>
      <div className="lp-marquee-track">
        {doubled.map((id, i) => (
          <span
            key={`${id}-${i}`}
            className="sticker flex w-24 shrink-0 flex-col items-center gap-1 px-2 py-2"
          >
            <Crest id={id} size={44} />
            <span className="w-full truncate text-center font-pixel text-[.45rem] text-ink">
              {CLUB_NAMES[id] ?? id}
            </span>
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
    title: 'Partida ao vivo',
    text: 'Placar grande, narração e campo animado em pixel art. Pause para mexer na tática ou pule direto para o resultado.',
    icon: <PixelWhistle size={28} />,
  },
  {
    title: 'Pirâmide brasileira',
    text: 'Séries A, B e C com acesso e rebaixamento, Copa do Brasil, estaduais e Libertadores com os gigantes do continente.',
    icon: <PixelTrophy size={28} />,
  },
  {
    title: 'Mercado com janelas',
    text: 'Duas janelas por temporada. Compre, venda, empreste e receba propostas da IA pelos seus craques.',
    icon: <PixelCoin size={28} />,
  },
  {
    title: 'Escritório de verdade',
    text: 'Negocie patrocínios, cuide do sócio-torcedor, feche contratos e segure o caixa no azul.',
    icon: <PixelCard size={28} />,
  },
  {
    title: 'Treinador com personalidade',
    text: 'Motivador, Disciplinador, Diplomata ou Estrategista: cada estilo muda o vestiário, a imprensa e o jogo.',
    icon: <PixelHeart size={28} />,
  },
  {
    title: 'Ranking global grátis',
    text: 'Suas conquistas validadas pelo servidor entram no ranking de treinadores. Sem pagar nada.',
    icon: <PixelStar size={28} />,
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Entre',
    text: 'Google ou link mágico no e-mail. Sem senha para decorar.',
  },
  {
    n: '02',
    title: 'Crie seu treinador',
    text: 'Nome, bandeira, avatar pixel e a personalidade que vai guiar o clube.',
  },
  {
    n: '03',
    title: 'Escolha o clube',
    text: 'Todos os clubes das Séries A, B e C, com elenco de 2026 por posição.',
  },
  {
    n: '04',
    title: 'Avance rodadas',
    text: 'Escale, jogue, negocie e suba de série. Salvo na nuvem, continue em qualquer aparelho.',
  },
] as const;

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const title = 'FOOTEBAS';

  return (
    <div ref={root} className="min-h-dvh">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <Brand />
        <nav aria-label="Principal" className="flex items-center gap-3">
          <a
            href="#licenca"
            className="hidden font-pixel text-[.5rem] uppercase text-chalk underline underline-offset-4 sm:inline"
          >
            Licença
          </a>
          <a
            href={GAME_URL}
            className="btn-px btn-chalk inline-flex min-h-10 items-center px-3 text-[.55rem]"
          >
            Entrar
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-14">
        <div className="relative min-w-0">
          <span
            className="lp-float absolute -left-2 -top-6 hidden sm:block"
            style={{ '--delay': '0.3s' } as React.CSSProperties}
          >
            <PixelBall size={28} />
          </span>
          <span
            className="lp-float absolute right-2 -top-8 hidden sm:block"
            style={{ '--delay': '0.9s' } as React.CSSProperties}
          >
            <PixelTrophy size={32} />
          </span>
          <p className="ticker block w-full max-w-full px-3 py-2 text-[.5rem] sm:text-[.55rem]">
            <span className="ticker-text">
              Manager de futebol brasileiro · grátis · direto no celular ·
              Séries A, B e C com elencos de 2026 · Copa do Brasil · Libertadores
              ·
            </span>
          </p>
          <h1
            className="lp-title mt-5 font-pixel text-4xl leading-none text-chalk drop-shadow-[0_4px_0_rgb(21_32_26)] sm:text-6xl lg:text-[3.25rem] xl:text-6xl"
            aria-label={title}
          >
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
          <p className="lp-cursor mt-4 font-pixel text-[.7rem] leading-relaxed text-bulb sm:text-sm">
            Sua carreira, sua história
          </p>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-chalk sm:text-lg">
            Pegue um clube brasileiro de verdade, monte o elenco, negocie no
            mercado e suba de série. Rodada em poucos toques, no navegador, com
            a cara dos managers que você jogava na lan house.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={GAME_URL}
              className="play-button inline-flex min-h-14 items-center justify-center gap-3 px-6 text-[.7rem] sm:text-xs"
            >
              <span className="lp-nudge inline-flex">
                <PixelArrow size={18} />
              </span>
              Começar carreira grátis
            </a>
            <a
              href="#licenca"
              className="btn-px btn-board inline-flex min-h-12 items-center justify-center gap-2 px-5 text-[.6rem]"
            >
              <PixelCoin size={16} />
              Ver a licença
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-pixel text-[.5rem] leading-relaxed text-chalk/85">
            <li>Sem instalar</li>
            <li>Sem assinatura</li>
            <li>Sem anúncios</li>
            <li>Sem pay-to-win</li>
          </ul>
        </div>
        <LiveMatch />
      </section>

      {/* Crest shelf */}
      <section aria-label="Clubes do jogo" className="flex flex-col gap-3 py-4">
        <Marquee ids={SERIE_A} />
        <Marquee ids={SERIE_BC} dir="reverse" />
        <p className="px-4 text-center font-pixel text-[.5rem] leading-relaxed text-chalk/80">
          Todos os clubes das Séries A, B e C de 2026, mais os estrangeiros da
          Libertadores
        </p>
      </section>

      {/* Benefits */}
      <section
        aria-labelledby="beneficios"
        className="mx-auto max-w-6xl px-4 py-12 sm:px-6"
      >
        <div className="lp-reveal panel-chalk p-4 sm:p-6">
          <h2
            id="beneficios"
            className="font-pixel text-sm leading-relaxed text-chalk sm:text-lg"
          >
            Por que jogar Footebas
          </h2>
          <p className="mt-2 max-w-prose text-sm text-chalk/85 sm:text-base">
            Um manager completo, não uma demo capada. Tudo abaixo está liberado
            no plano grátis.
          </p>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((benefit, i) => (
            <li
              key={benefit.title}
              className="lp-reveal lp-sticker sticker flex flex-col gap-3 p-5"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="px-border grid size-11 place-items-center bg-board">
                  {benefit.icon}
                </span>
                <h3 className="font-pixel text-[.6rem] leading-relaxed text-ink sm:text-[.65rem]">
                  {benefit.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-ink/85">
                {benefit.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Club life: a scoreboard of what you manage */}
      <section
        aria-labelledby="clube"
        className="mx-auto max-w-6xl px-4 pb-12 sm:px-6"
      >
        <div className="lp-reveal panel-board grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2
              id="clube"
              className="led text-sm leading-relaxed sm:text-base"
            >
              Seu clube, rodada a rodada
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-chalk/85 sm:text-base">
              Da Central você vê o próximo jogo, a tabela e a caixa de entrada
              com decisões que não esperam: proposta por um titular, patrocínio
              na mesa, o presidente cobrando acesso. No Mapa do clube, cada
              prédio em pixel art abre uma tela: CT, estádio, sede e imprensa.
            </p>
            <ul className="mt-5 flex flex-col gap-3 font-pixel text-[.5rem] text-chalk/90">
              {[
                ['Força do elenco', '72%', 'bulb'],
                ['Moral do vestiário', '84%', ''],
                ['Caixa do clube', '58%', ''],
                ['Entrosamento', '66%', 'bulb'],
              ].map(([label, w, tone]) => (
                <li key={label} className="flex flex-col gap-1">
                  <span className="flex justify-between">
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
          <div className="flex flex-col gap-3">
            <table className="teletext w-full text-chalk">
              <caption className="pb-2 text-left text-bulb">
                Série B · rodada 31
              </caption>
              <tbody>
                {[
                  ['1', 'club_coritiba', 'Coritiba', '61'],
                  ['2', 'club_goias', 'Goiás', '58'],
                  ['3', 'club_athletico_paranaense', 'Athletico-PR', '57'],
                  ['4', 'club_chapecoense', 'Chapecoense', '55'],
                  ['5', 'club_novorizontino', 'Novorizontino', '52'],
                ].map(([pos, id, name, pts]) => (
                  <tr key={id}>
                    <td className="w-6 px-1">{pos}</td>
                    <td className="w-8 px-1">
                      <Crest id={id!} size={18} />
                    </td>
                    <td className="px-1">{name}</td>
                    <td className="px-1 text-right text-bulb">{pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="font-pixel text-[.5rem] leading-relaxed text-chalk/70">
              Quatro sobem. Você está no G4 e falta um jogo. Vai pular ou
              assistir ao vivo?
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="como"
        className="mx-auto max-w-6xl px-4 pb-12 sm:px-6"
      >
        <h2
          id="como"
          className="lp-reveal font-pixel text-sm leading-relaxed text-chalk drop-shadow-[0_2px_0_rgb(21_32_26)] sm:text-lg"
        >
          Do login ao apito inicial
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.n}
              className="lp-reveal panel flex flex-col gap-2 p-5"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <span className="led text-xl">{step.n}</span>
              <h3 className="font-pixel text-[.6rem] leading-relaxed">
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-ink/85">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Licence */}
      <section
        id="licenca"
        aria-labelledby="licenca-titulo"
        className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-12 sm:px-6"
      >
        <div className="lp-reveal relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {Array.from({ length: 14 }, (_, i) => (
              <span
                key={i}
                className="lp-confetti"
                style={
                  {
                    left: `${(i * 7.3) % 100}%`,
                    background: ['#ffd23f', '#f4efe2', '#c8322b', '#7cc4ea'][
                      i % 4
                    ],
                    '--dur': `${3.5 + (i % 4)}s`,
                    '--delay': `${(i % 7) * -0.9}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <div className="panel flex flex-col gap-4 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <PixelBall size={26} />
                <h2
                  id="licenca-titulo"
                  className="font-pixel text-[.7rem] leading-relaxed sm:text-sm"
                >
                  Grátis
                </h2>
              </div>
              <p className="led text-2xl text-ink" style={{ textShadow: 'none' }}>
                R$ 0
              </p>
              <ul className="flex flex-col gap-2 text-sm leading-relaxed text-ink/90">
                <li>✔ Loop completo: elenco, mercado, escritório, temporada</li>
                <li>✔ {FREE_ENTITLEMENTS.maxCareers} carreira ativa, com nome</li>
                <li>✔ Começa na Série C e sobe no braço</li>
                <li>✔ Partida ao vivo e ranking global</li>
                <li>✔ Salvo na nuvem</li>
              </ul>
              <a
                href={GAME_URL}
                className="btn-px btn-grass mt-auto inline-flex min-h-12 items-center justify-center px-4 text-[.6rem]"
              >
                Jogar de graça
              </a>
            </div>

            <div className="panel-board relative flex flex-col gap-4 p-5 sm:p-6">
              <span className="lp-tag absolute right-4 top-0 inline-flex items-center gap-2 border-2 border-ink bg-bulb px-2 py-1 font-pixel text-[.5rem] uppercase text-bulb-foreground">
                <span className="lp-coin inline-flex">
                  <PixelCoin size={12} />
                </span>
                Pagamento único
              </span>
              <div className="flex items-center gap-3">
                <PixelStar size={28} />
                <h2 className="led text-sm leading-relaxed sm:text-base">
                  Licença Footebas
                </h2>
              </div>
              <p className="led text-3xl sm:text-4xl">
                {formatCents(LICENSE_PRICE_CENTS)}
              </p>
              <p className="text-sm leading-relaxed text-chalk/85">
                Uma licença única libera a edição completa. Nada muda dentro de
                campo: a vantagem é só de liberdade, nunca esportiva.
              </p>
              <ul className="flex flex-col gap-2 text-sm leading-relaxed text-chalk">
                <li className="flex gap-2">
                  <PixelStar size={14} className="mt-1" />
                  Até {LICENSED_ENTITLEMENTS.maxCareers} carreiras ao mesmo
                  tempo, cada uma com nome
                </li>
                <li className="flex gap-2">
                  <PixelStar size={14} className="mt-1" />
                  Comece em qualquer clube, de qualquer série
                </li>
                <li className="flex gap-2">
                  <PixelStar size={14} className="mt-1" />
                  PIX na hora. Sem assinatura, sem renovação
                </li>
                <li className="flex gap-2">
                  <PixelStar size={14} className="mt-1" />
                  Arrependeu? Reembolso integral em até 7 dias
                </li>
              </ul>
              <a
                href={GAME_URL}
                className="play-button mt-auto inline-flex min-h-14 items-center justify-center gap-3 px-5 text-[.65rem]"
              >
                <PixelCoin size={18} />
                Entrar e pagar com PIX
              </a>
              <p className="text-xs text-chalk/70">
                O valor e o QR Code aparecem no seu perfil, dentro do jogo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="lp-reveal panel-chalk flex flex-col items-center gap-4 p-6 text-center sm:p-10">
          <div className="flex items-center gap-3">
            <Crest id="club_gremio" size={40} />
            <Crest id="club_corinthians" size={40} />
            <Crest id="club_bahia" size={40} />
            <Crest id="club_cruzeiro" size={40} />
            <Crest id="club_santos" size={40} />
          </div>
          <h2 className="font-pixel text-sm leading-relaxed text-chalk sm:text-xl">
            Qual clube você vai levar ao título?
          </h2>
          <p className="max-w-prose text-sm text-chalk/85 sm:text-base">
            A carreira começa em um minuto e fica salva na nuvem. Primeiro jogo
            hoje.
          </p>
          <a
            href={GAME_URL}
            className="play-button inline-flex min-h-14 items-center justify-center gap-3 px-8 text-[.7rem] sm:text-xs"
          >
            <PixelArrow size={18} />
            Começar carreira
          </a>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="panel-wood flex flex-wrap items-center justify-between gap-3 px-4 py-3 font-pixel text-[.5rem] text-chalk">
          <span>Footebas · feito no Brasil</span>
          <nav aria-label="Documentos legais" className="flex gap-4">
            <a className="underline underline-offset-4" href="/termos">
              Termos de uso
            </a>
            <a className="underline underline-offset-4" href="/privacidade">
              Privacidade
            </a>
          </nav>
        </div>
        <p className="mt-3 text-center text-xs text-chalk/70">
          Escudos e nomes dos clubes pertencem aos seus donos e aparecem apenas
          para identificar as equipes do jogo.
        </p>
      </footer>
    </div>
  );
}
