import { DomainError } from './errors.js';

const GAME_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class GameDate {
  private constructor(private readonly iso: string) {}

  public static parse(value: string): GameDate {
    const match = GAME_DATE_PATTERN.exec(value);
    if (!match) {
      throw new DomainError('INVALID_GAME_DATE', `Invalid GameDate: ${value}`, {
        value,
      });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const instant = new Date(Date.UTC(year, month - 1, day));
    if (
      instant.getUTCFullYear() !== year ||
      instant.getUTCMonth() !== month - 1 ||
      instant.getUTCDate() !== day
    ) {
      throw new DomainError(
        'INVALID_GAME_DATE',
        `Invalid calendar date: ${value}`,
        { value },
      );
    }

    return new GameDate(value);
  }

  public addDays(days: number): GameDate {
    if (!Number.isSafeInteger(days)) {
      throw new DomainError(
        'INVALID_GAME_DATE',
        'GameDate days must be a safe integer',
        { days },
      );
    }
    const instant = new Date(`${this.iso}T00:00:00.000Z`);
    instant.setUTCDate(instant.getUTCDate() + days);
    return GameDate.parse(instant.toISOString().slice(0, 10));
  }

  public compare(other: GameDate): number {
    return this.iso.localeCompare(other.iso);
  }

  public toJSON(): string {
    return this.iso;
  }

  public toString(): string {
    return this.iso;
  }
}
