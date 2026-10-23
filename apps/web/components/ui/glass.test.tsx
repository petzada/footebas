import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Glass } from '@/components/ui/glass';

// Vitest runs from apps/web.
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

function rule(prelude: string): string {
  const start = css.indexOf(prelude);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}' && --depth === 0) return css.slice(open, index);
  }
  throw new Error(`unterminated ${prelude}`);
}

describe('vidro ISOPOP', () => {
  it('renderiza a superfície com a classe de vidro e a variante forte', () => {
    render(
      <>
        <Glass as="section" aria-label="Painel comum">
          a
        </Glass>
        <Glass strong aria-label="Painel forte" className="p-4">
          b
        </Glass>
      </>,
    );
    const regular = screen.getByRole('region', { name: 'Painel comum' });
    expect(regular.tagName).toBe('SECTION');
    expect(regular.className).toMatch(/\bglass\b/);
    expect(regular.dataset.glass).toBe('regular');
    const strong = screen.getByLabelText('Painel forte');
    expect(strong.className).toMatch(/\bglass-strong\b/);
    expect(strong.className).toMatch(/\bp-4\b/);
    expect(strong.dataset.glass).toBe('strong');
  });

  it('usa branco a 50%, borda clara, sombra suave e o token único de blur', () => {
    const glass = rule('  .glass,\n  .glass-strong {');
    expect(glass).toMatch(/background:\s*var\(--glass-bg\)/);
    expect(glass).toMatch(/border:\s*1px solid var\(--glass-border\)/);
    expect(glass).toMatch(/box-shadow:\s*var\(--glass-shadow\)/);
    expect(glass).toMatch(/backdrop-filter:\s*blur\(var\(--glass-blur\)\)/);
    expect(glass).toMatch(
      /-webkit-backdrop-filter:\s*blur\(var\(--glass-blur\)\)/,
    );
  });

  it('vira superfície opaca sem backdrop-filter ou com transparência reduzida', () => {
    const prelude = css.slice(css.indexOf('@supports not ('));
    expect(prelude.slice(0, prelude.indexOf('{'))).toMatch(
      /\(backdrop-filter: blur\(1px\)\)/,
    );
    const unsupported = rule('@supports not (');
    expect(unsupported).toMatch(/\.glass,\s*\.glass-strong/);
    expect(unsupported).toMatch(/background:\s*var\(--glass-fallback\)/);
    const reduced = rule('@media (prefers-reduced-transparency: reduce)');
    expect(reduced).toMatch(/\.glass,\s*\.glass-strong/);
    expect(reduced).toMatch(/background:\s*var\(--glass-fallback\)/);
    expect(reduced).toMatch(/backdrop-filter:\s*none/);
    expect(css).toMatch(/--glass-fallback:\s*#[0-9a-f]{6};/);
  });

  it('listas longas usam superfície sem blur', () => {
    const surface = rule('  .surface {');
    expect(surface).not.toMatch(/backdrop-filter/);
  });
});
