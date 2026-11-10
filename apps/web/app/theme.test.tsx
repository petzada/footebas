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

describe('tokens Transmissão (ADR 0018)', () => {
  it('é um tema só, escuro: sem variante .dark, sem bootstrap de tema', () => {
    expect(css).not.toMatch(/\.dark/);
    expect(css).not.toMatch(/@custom-variant\s+dark/);
    expect(block(':root')).toMatch(/color-scheme:\s*dark/);
    const html = RootLayout({ children: null });
    expect(html.props.className).toBeUndefined();
    expect(JSON.stringify(html.props.children)).not.toMatch(/footebas-theme/);
    expect(viewport.themeColor.toLowerCase()).toBe('#090d13');
    expect(viewport.colorScheme).toBe('dark');
    expect(manifest().theme_color?.toLowerCase()).toBe('#090d13');
  });

  it('usa noite, painel grafite, verde de gramado e dourado de placar', () => {
    const tokens = block(':root');
    expect(tokens).toMatch(/--background:\s*#090d13/);
    expect(tokens).toMatch(/--card:\s*#141b25/);
    expect(tokens).toMatch(/--grass:\s*#1fb866/);
    expect(tokens).toMatch(/--chalk:\s*#eef2f6/);
    expect(tokens).toMatch(/--board:\s*#0a0f16/);
    expect(tokens).toMatch(/--bulb:\s*#f6c443/);
    expect(tokens).toMatch(/--ink:\s*#06090d/);
    // The pastel glass of ISOPOP and the CRT scanlines of the retro theme left.
    expect(css).not.toMatch(/--glass-|#bee3f0|#f9e2e7|body::after/);
    expect(css).toMatch(/body::before\s*{[^}]*radial-gradient/s);
  });

  it('desenha superfícies com fio de luz, raio curto e botões que afundam', () => {
    const border = block('  .px-border');
    expect(border).toMatch(/border-radius:\s*var\(--radius-lg\)/);
    expect(border).toMatch(/0 0 0 1px var\(--line-strong\)/);
    expect(css).toMatch(/--radius-lg:\s*10px/);
    expect(css).toMatch(/\.panel-board\s*{/);
    expect(css).toMatch(/\.btn-px:active[^{]*{[^}]*translateY\(1px\)/s);
    expect(css).toMatch(/\.play-button::after\s*{[^}]*animation:\s*sheen/s);
  });

  it('display condensado e corpo em Barlow, com algarismos tabulares', () => {
    expect(css).toMatch(/--font-display:\s*'Barlow Condensed'/);
    expect(css).toMatch(/--font-pixel:\s*var\(--font-display\)/);
    expect(css).toMatch(/--font-sans:\s*'Barlow'/);
    expect(css).toMatch(/font-variant-numeric:\s*tabular-nums/);
    expect(css).not.toMatch(/Press Start 2P|Archivo|Rajdhani/);
  });

  it('traz os grafismos de transmissão do estádio 3D', () => {
    for (const name of [
      'stage-frame',
      'hud-scorebug',
      'hud-goal',
      'hud-lower',
      'hud-chip',
    ])
      expect(css).toContain(`.${name} {`);
    expect(css).toMatch(/\.stage-frame:fullscreen/);
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
