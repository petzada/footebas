export type DomainErrorCode =
  | 'INVALID_CANONICAL_VALUE'
  | 'INVALID_ENTITY'
  | 'INVALID_GAME_DATE'
  | 'INVALID_ID'
  | 'INVALID_VALUE';

export class DomainError extends Error {
  public override readonly name = 'DomainError';

  public constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}
