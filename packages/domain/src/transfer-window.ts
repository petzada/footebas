import { DomainError } from './errors.js';
import { GameDate } from './game-date.js';

/** Bump when a window date or rule changes (docs/adr/0008). */
export const TRANSFER_WINDOW_RULES_VERSION = 'transfer-windows-v1' as const;

export type TransferWindowId = 'pre_season' | 'mid_season';

export interface TransferWindowDefinition {
  readonly id: TransferWindowId;
  readonly name: string;
  /** Day of the season counted from 1 January (day 0), like the calendar. */
  readonly opensOnDay: number;
  /** Last open day, inclusive. */
  readonly closesOnDay: number;
}

/**
 * Two windows per season. The season calendar starts on 1 January (day 0)
 * and the Brasileirão opens on day 48 (`competitions-2026.json`), so the
 * pre-season window closes the day before. The mid-season window sits
 * between the turns of the league, around the Copa do Brasil.
 */
export const TRANSFER_WINDOWS: readonly TransferWindowDefinition[] =
  Object.freeze([
    Object.freeze({
      id: 'pre_season' as const,
      name: 'Janela de pré-temporada',
      opensOnDay: 0,
      closesOnDay: 47,
    }),
    Object.freeze({
      id: 'mid_season' as const,
      name: 'Janela do meio do ano',
      opensOnDay: 106,
      closesOnDay: 127,
    }),
  ]);

export interface TransferWindow {
  readonly id: TransferWindowId;
  readonly name: string;
  readonly opensOn: string;
  readonly closesOn: string;
}

export interface TransferWindowStatus {
  readonly rulesVersion: typeof TRANSFER_WINDOW_RULES_VERSION;
  readonly open: boolean;
  readonly current?: TransferWindow;
  /** Whole days after today until the current window closes (0 on the last day). */
  readonly daysRemaining?: number;
  /** Next window to open after today (may be next year). */
  readonly next: TransferWindow;
  readonly daysUntilNext: number;
  /** Both windows of the date's year. */
  readonly windows: readonly TransferWindow[];
}

const DAY = 86_400_000;
const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      DAY,
  );

export function transferWindowsFor(year: number): readonly TransferWindow[] {
  if (!Number.isInteger(year) || year < 1 || year > 9999)
    throw new DomainError('INVALID_VALUE', 'invalid transfer window year');
  const start = GameDate.parse(`${String(year).padStart(4, '0')}-01-01`);
  return Object.freeze(
    TRANSFER_WINDOWS.map((window) =>
      Object.freeze({
        id: window.id,
        name: window.name,
        opensOn: start.addDays(window.opensOnDay).toString(),
        closesOn: start.addDays(window.closesOnDay).toString(),
      }),
    ),
  );
}

export function transferWindowStatus(date: string): TransferWindowStatus {
  GameDate.parse(date);
  const year = Number(date.slice(0, 4));
  const windows = transferWindowsFor(year);
  const current = windows.find(
    ({ opensOn, closesOn }) => opensOn <= date && date <= closesOn,
  );
  const next =
    windows.find(({ opensOn }) => opensOn > date) ??
    transferWindowsFor(year + 1)[0];
  if (next === undefined)
    throw new DomainError('INVALID_VALUE', 'no transfer window configured');
  return Object.freeze({
    rulesVersion: TRANSFER_WINDOW_RULES_VERSION,
    open: current !== undefined,
    ...(current === undefined
      ? {}
      : { current, daysRemaining: daysBetween(date, current.closesOn) }),
    next,
    daysUntilNext: daysBetween(date, next.opensOn),
    windows,
  });
}

export function isTransferWindowOpen(date: string): boolean {
  return transferWindowStatus(date).open;
}
