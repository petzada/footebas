import { DomainError } from './errors.js';

type CanonicalPrimitive = boolean | null | number | string;
export type CanonicalValue =
  CanonicalPrimitive | CanonicalValue[] | { [key: string]: CanonicalValue };

function normalize(value: unknown, path: string): CanonicalValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DomainError(
        'INVALID_CANONICAL_VALUE',
        `Non-finite number at ${path}`,
        { path, value },
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      const normalized = normalize(entry, `${path}[${String(index)}]`);
      if (normalized === undefined) {
        throw new DomainError(
          'INVALID_CANONICAL_VALUE',
          `Undefined array item at ${path}[${String(index)}]`,
        );
      }
      return normalized;
    });
  }
  if (typeof value === 'object') {
    const candidate =
      typeof (value as { toJSON?: unknown }).toJSON === 'function'
        ? (value as { toJSON: () => unknown }).toJSON()
        : value;
    if (candidate !== value) return normalize(candidate, path);

    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value).sort()) {
      const normalized = normalize(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
      if (normalized !== undefined) result[key] = normalized;
    }
    return result;
  }
  throw new DomainError(
    'INVALID_CANONICAL_VALUE',
    `Unsupported canonical value at ${path}`,
    {
      path,
      type: typeof value,
    },
  );
}

export function canonicalJson(value: unknown): string {
  const normalized = normalize(value, '$');
  if (normalized === undefined) {
    throw new DomainError(
      'INVALID_CANONICAL_VALUE',
      'Root canonical value cannot be undefined',
    );
  }
  return JSON.stringify(normalized);
}
