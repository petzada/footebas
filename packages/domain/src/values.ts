import { DomainError } from './errors.js';

declare const strengthBrand: unique symbol;
declare const percentageBrand: unique symbol;
declare const moneyBrand: unique symbol;

export type Strength = number & { readonly [strengthBrand]: true };
export type Percentage = number & { readonly [percentageBrand]: true };
export type Money = number & { readonly [moneyBrand]: true };

function boundedInteger(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new DomainError('INVALID_VALUE', `${name} must be an integer from ${String(minimum)} to ${String(maximum)}`, { value });
  }
  return value;
}

export function strength(value: number): Strength {
  return boundedInteger(value, 1, 100, 'Strength') as Strength;
}

export function percentage(value: number): Percentage {
  return boundedInteger(value, 0, 100, 'Percentage') as Percentage;
}

/** Integer minor units (centavos), safe for canonical JSON and arithmetic. */
export function money(value: number): Money {
  if (!Number.isSafeInteger(value)) {
    throw new DomainError('INVALID_VALUE', 'Money must be a safe integer in minor units', { value });
  }
  return value as Money;
}

export const POSITIONS = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

export const PLAYER_TRAITS = [
  'pace', 'crossing', 'playmaking', 'passing', 'heading', 'marking', 'tackling',
  'finishing', 'positioning', 'aerial_command', 'reflexes', 'penalty_saving',
] as const;
export type PlayerTrait = (typeof PLAYER_TRAITS)[number];
