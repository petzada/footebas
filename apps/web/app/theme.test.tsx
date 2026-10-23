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

describe('tokens ISOPOP (ADR 0009)', () => {
  it('é só modo claro: sem variante .dark, sem bootstrap de tema', () => {
    expect(css).not.toMatch(/\.dark\b/);
    expect(css).not.toMatch(/@custom-variant\s+dark/);
    expect(block(':root')).toMatch(/color-scheme:\s*light/);
    const html = RootLayout({ children: null });
    expect(html.props.className).toBeUndefined();
    expect(JSON.stringify(html.props.children)).not.toMatch(/footebas-theme/);
    expect(viewport.themeColor.toLowerCase()).toBe('#bee3f0');
    expect(manifest().theme_color?.toLowerCase()).toBe('#bee3f0');
  });

  it('usa a paleta pastel do design.md, texto #17263A e as cores da marca', () => {
    const tokens = block(':root');
    for (const color of ['#bee3f0', '#dff3f1', '#fdf1e3', '#f9e2e7', '#e4eef7'])
      expect(tokens).toContain(color);
    expect(tokens).toMatch(/--foreground:\s*#17263a/);
    expect(tokens).toMatch(/--primary-gradient:\s*linear-gradient/);
    expect(tokens).toMatch(/--coral:\s*#f57a57/);
    expect(css).toMatch(/body::before\s*{[^}]*radial-gradient/s);
  });

  it('define um único token de blur (18px) usado por todo vidro', () => {
    expect(block(':root')).toMatch(/--glass-blur:\s*18px/);
    expect(css.match(/--glass-blur:/g)).toHaveLength(1);
    const literalBlurs =
      css.match(/blur\((?!var\(--glass-blur\))[^)]*\)/g) ?? [];
    // Only the feature query probes a literal blur.
    expect(literalBlurs.every((value) => value === 'blur(1px)')).toBe(true);
    expect(block(':root')).toMatch(/--glass-bg:\s*rgb\(255 255 255 \/ 0\.5\)/);
  });

  it('tipografia system-ui com algarismos tabulares e Courier New só como acento', () => {
    expect(css).toMatch(/--font-sans:\s*\n?\s*system-ui/);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(css).toMatch(/--font-mono:\s*'Courier New'/);
    expect(css).not.toMatch(/Archivo|Rajdhani/);
  });

  it('desliga animações com prefers-reduced-motion', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[^@]*animation:\s*none/s,
    );
  });

  it('nenhum componente usa a variante dark: nem fontes antigas', () => {
    const offenders = sources(join(root, 'components'))
      .concat(sources(join(root, 'app')))
      .filter((file) =>
        /\bdark:|Rajdhani|Archivo|footebas-theme/.test(
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
