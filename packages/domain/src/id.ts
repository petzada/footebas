import { DomainError } from './errors.js';

declare const idBrand: unique symbol;

export type EntityId<TKind extends string> = string & {
  readonly [idBrand]: TKind;
};

const ID_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

export function entityId<TKind extends string>(
  value: string,
  kind: TKind,
): EntityId<TKind> {
  if (!ID_PATTERN.test(value)) {
    throw new DomainError('INVALID_ID', `Invalid ${kind} id: ${value}`, {
      kind,
      value,
    });
  }

  return value as EntityId<TKind>;
}
