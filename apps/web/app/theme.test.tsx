import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import RootLayout, { viewport } from '@/app/layout';
import manifest from '@/app/manifest';

// Vitest runs from apps/web.
const root = process.cwd();
const css = readFileSync(join(root, 'app/globals.css'), 'utf8');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

/** Declarations of one top-level rule, e.g. `:root { … }`. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('\n}', start));
}

describe('tokens Futebol Retrô (ADR 0012)', () => {
  it('é um tema só: sem variante .dark, sem bootstrap de tema', () => {
    expect(css).not.toMatch(/\.dark\b/);
    expect(css).not.toMatch(/@custom-variant\s+dark/);
    expect(block(':root')).toMatch(/color-scheme:\s*light/);
    const html = RootLayout({ children: null });
    expect(html.props.className).toBeUndefined();
    expect(JSON.stringify(html.props.children)).not.toMatch(/footebas-theme/);
    expect(viewport.themeColor.toLowerCase()).toBe('#2f7d3a');
    expect(manifest().theme_color?.toLowerCase()).toBe('#2f7d3a');
  });

  it('usa gramado, giz, placar e madeira; o vidro e os pastéis saíram', () => {
    const tokens = block(':root');
    expect(tokens).toMatch(/--grass:\s*#2f7d3a/);
    expect(tokens).toMatch(/--chalk:\s*#f4efe2/);
    expect(tokens).toMatch(/--board:\s*#121a15/);
    expect(tokens).toMatch(/--bulb:\s*#ffd23f/);
    expect(tokens).toMatch(/--wood:\s*#a0672f/);
    expect(tokens).toMatch(/--ink:\s*#15201a/);
    expect(css).not.toMatch(/backdrop-filter|--glass-|#bee3f0|#f9e2e7/);
    expect(css).toMatch(/body::before\s*{[^}]*repeating-linear-gradient/s);
  });

  it('desenha bordas pixel em degraus com box-shadow e sem raio', () => {
    const border = block('  .px-border');
    expect(border).toMatch(/0 calc\(var\(--px\) \* -1\) 0 0 var\(--ink\)/);
    expect(border).not.toMatch(/blur|border-radius/);
    expect(css).toMatch(/--radius-xl:\s*0px/);
    expect(css).toMatch(/\.panel-board\s*{/);
    expect(css).toMatch(/\.btn-px:active[^{]*{[^}]*translateY\(var\(--px\)\)/s);
  });

  it('fonte pixelada só no display; corpo em system-ui com algarismos tabulares', () => {
    expect(css).toMatch(/--font-pixel:\s*'Press Start 2P'/);
    expect(css).toMatch(/--font-display:\s*var\(--font-pixel\)/);
    expect(css).toMatch(/--font-sans:\s*\n?\s*system-ui/);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(css).not.toMatch(/Archivo|Rajdhani/);
  });

  it('desliga animações e o letreiro com prefers-reduced-motion', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion'));
    expect(reduced).toMatch(/animation:\s*none/);
    expect(reduced).toMatch(/\.ticker-text\s*{[^}]*white-space:\s*normal/s);
  });

  it('nenhum componente usa a variante dark, vidro ou fontes antigas', () => {
    const offenders = sources(join(root, 'components'))
      .concat(sources(join(root, 'app')))
      .filter((file) =>
        /\bdark:|Rajdhani|Archivo|footebas-theme|glass-strong|ui\/glass/.test(
          readFileSync(file, 'utf8'),
        ),
      );
    expect(offenders).toEqual([]);
  });

  it('componentes de components/ui não definem cores soltas', () => {
    const literal =
      /#[0-9a-f]{3,8}\b|rgba?\(|hsl\(|oklch\(|\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|red|green|blue|gray|slate|zinc|neutral|emerald|amber|orange|sky)-?/i;
    const offenders = sources(join(root, 'components/ui')).filter((file) =>
      literal.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
