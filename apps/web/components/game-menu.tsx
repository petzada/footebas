'use client';

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Bank,
  Bell,
  Briefcase,
  CalendarDots,
  ChartLineUp,
  ClockCounterClockwise,
  FileText,
  House,
  ListNumbers,
  MapTrifold,
  Ranking,
  ShieldCheck,
  SignOut,
  SoccerBall,
  Storefront,
  Strategy,
  UserCircle,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import { MuteButton } from '@/components/retro/mute-button';
import type { CareerView, Screen } from '@/lib/career-api';
import { transferWindowOn } from '@/lib/management-model';
import { useSound } from '@/lib/retro/use-sound';
import { cn } from '@/lib/utils';

export type Destination = readonly [Screen, string, typeof House];

/**
 * Game-menu groups (docs/09 screen map). Every menu screen lives in exactly
 * one group so `aria-current` always has a home; the bottom bar repeats the
 * four screens of the round loop (docs/07 §3) plus the menu trigger. The
 * desktop sidebar shows a heading only for Clube and Carreira; the mobile
 * menu titles every group. Competições lives inside Calendário.
 */
interface MenuGroup {
  id: 'inicio' | 'clube' | 'futebol' | 'carreira';
  /** Visible heading on the desktop sidebar; absent means no heading. */
  label?: string;
  /** Heading of the group in the mobile game menu (and its region name). */
  menuLabel: string;
  items: readonly Destination[];
}

export const menuGroups: readonly MenuGroup[] = [
  {
    id: 'inicio',
    menuLabel: 'Principal',
    items: [
      ['central', 'Central', House],
      ['map', 'Mapa', MapTrifold],
      ['inbox', 'Caixa de entrada', Bell],
    ],
  },
  {
    id: 'clube',
    label: 'Clube',
    menuLabel: 'Clube',
    items: [
      ['squad', 'Elenco', UsersThree],
      ['tactics', 'Táticas', Strategy],
      ['finance', 'Finanças', Bank],
      ['office', 'Escritório', Briefcase],
      ['stadium', 'Estádio', SoccerBall],
    ],
  },
  {
    id: 'futebol',
    menuLabel: 'Futebol',
    items: [
      ['market', 'Mercado', Storefront],
      ['table', 'Classificação', ListNumbers],
      ['calendar', 'Calendário', CalendarDots],
      ['season', 'Temporada', ChartLineUp],
    ],
  },
  {
    id: 'carreira',
    label: 'Carreira',
    menuLabel: 'Carreira',
    items: [
      ['history', 'Histórico', ClockCounterClockwise],
      ['ranking', 'Ranking', Ranking],
      ['profile', 'Perfil', UserCircle],
    ],
  },
];

export const destinations: readonly Destination[] = menuGroups.flatMap(
  (group) => group.items,
);

/** Round loop: play/advance, line-up, window, proposals. */
export const barDestinations = [
  ['central', 'Central', House],
  ['squad', 'Elenco', UsersThree],
  ['market', 'Mercado', Storefront],
  ['office', 'Escritório', Briefcase],
] as const satisfies ReadonlyArray<Destination>;

/** Screen titles; Competições has no menu entry (it opens from Calendário). */
export const labels = {
  ...Object.fromEntries(destinations.map(([id, label]) => [id, label])),
  competitions: 'Competições',
} as Record<Screen, string>;

/** Counters shown on menu buttons (unread mail, open window). */
export function menuBadges(
  career: CareerView,
): Partial<Record<Screen, string>> {
  const badges: Partial<Record<Screen, string>> = {};
  const mail = career.world.news.length;
  if (mail > 0) badges.inbox = mail > 99 ? '99+' : String(mail);
  // The next fixture date is the closest thing to "today" the shell has.
  const date = career.fixture?.date;
  if (date && transferWindowOn(date).status === 'open')
    badges.market = 'Aberta';
  return badges;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Full-screen pause-menu dialog (mobile). Focus is trapped, `Esc` and the
 * close button dismiss it, focus returns to the trigger, arrows move through
 * the button grid.
 */
export function GameMenu({
  open,
  onClose,
  screen,
  career,
  navigate,
  onHome,
  onSignOut,
  returnFocusTo,
}: {
  open: boolean;
  onClose(): void;
  screen: Screen;
  career: CareerView;
  navigate(value: Screen): void;
  onHome?: (() => void) | undefined;
  onSignOut?: (() => void) | undefined;
  returnFocusTo: React.RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { play } = useSound();
  const badges = menuBadges(career);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = returnFocusTo.current;
    const current =
      dialog?.querySelector<HTMLElement>('[aria-current="page"]') ??
      dialog?.querySelector<HTMLElement>(FOCUSABLE);
    current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open, returnFocusTo]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    const arrows: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 3,
      ArrowUp: -3,
    };
    const step = arrows[event.key];
    if (step === undefined && event.key !== 'Home' && event.key !== 'End')
      return;
    const items = [...dialog.querySelectorAll<HTMLElement>('[data-menu-item]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : Math.min(items.length - 1, Math.max(0, index + (step ?? 0)));
    items[target]?.focus();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="game-menu"
      className="panel-board px-rise fixed inset-0 z-50 flex flex-col overflow-hidden lg:hidden"
      onKeyDown={onKeyDown}
    >
      <header className="flex items-center justify-between gap-3 border-b-4 border-ink px-4 pt-[max(.75rem,env(safe-area-inset-top))] pb-3">
        <div className="min-w-0">
          <p className="led text-[.5rem] tracking-[.2em]">Pausa</p>
          <h2 id={titleId} className="truncate font-pixel text-sm text-chalk">
            Menu do jogo
          </h2>
        </div>
        <button
          type="button"
          aria-label="Fechar menu"
          className="btn-px btn-chalk inline-flex size-11 items-center justify-center"
          onClick={onClose}
        >
          <X weight="bold" aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {menuGroups.map((group) => (
          <MenuSection key={group.id} id={group.id} label={group.menuLabel}>
            {group.items.map(([id, label, Icon]) => (
              <MenuButton
                key={id}
                label={label}
                icon={
                  <Icon className="size-7" weight="fill" aria-hidden="true" />
                }
                current={screen === id}
                badge={badges[id]}
                onClick={() => {
                  play('click');
                  navigate(id);
                }}
              />
            ))}
          </MenuSection>
        ))}
        <MenuSection id="sistema" label="Sistema">
          <MuteButton className="min-h-20 flex-col justify-center gap-1.5 px-1 text-[.5rem] [&>span]:inline" />
          {onHome && (
            <MenuButton
              label="Início"
              icon={
                <SoccerBall
                  className="size-7"
                  weight="fill"
                  aria-hidden="true"
                />
              }
              onClick={onHome}
            />
          )}
          <MenuLink href="/termos" label="Termos" icon={FileText} />
          <MenuLink
            href="/privacidade"
            label="Privacidade"
            icon={ShieldCheck}
          />
          {onSignOut && (
            <MenuButton
              label="Sair"
              icon={
                <SignOut className="size-7" weight="fill" aria-hidden="true" />
              }
              tone="red"
              onClick={onSignOut}
            />
          )}
        </MenuSection>
      </div>
    </div>
  );
}

function MenuSection({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  const headingId = `menu-${id}`;
  return (
    <section aria-labelledby={headingId} className="pt-4">
      <h3
        id={headingId}
        className="mb-2 px-1 font-pixel text-[.55rem] tracking-[.15em] text-bulb"
      >
        {label}
      </h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{children}</div>
    </section>
  );
}

const menuItemClass =
  'btn-px relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-1.5 px-1 py-2 text-center text-[.45rem] normal-case leading-tight tracking-tight break-words';

function MenuButton({
  label,
  icon,
  current = false,
  badge,
  tone = 'chalk',
  onClick,
}: {
  label: string;
  icon: ReactNode;
  current?: boolean;
  badge?: string | undefined;
  tone?: 'chalk' | 'red';
  onClick(): void;
}) {
  return (
    <button
      type="button"
      data-menu-item
      aria-current={current ? 'page' : undefined}
      className={cn(
        menuItemClass,
        tone === 'red' ? 'btn-red' : current ? 'btn-grass' : 'btn-chalk',
      )}
      onClick={onClick}
    >
      {icon}
      <span className="w-full">{label}</span>
      {badge && (
        <>
          <span className="sr-only">({badge})</span>
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 rounded-sm bg-bulb px-1 py-0.5 font-pixel text-[.4rem] text-bulb-foreground"
          >
            {badge}
          </span>
        </>
      )}
    </button>
  );
}

function MenuLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof House;
}) {
  return (
    <a
      href={href}
      data-menu-item
      className={cn(menuItemClass, 'btn-chalk no-underline')}
    >
      <Icon className="size-7" weight="fill" aria-hidden="true" />
      <span className="w-full">{label}</span>
    </a>
  );
}
