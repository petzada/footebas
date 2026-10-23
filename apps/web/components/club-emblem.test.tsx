import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ClubEmblem,
  clubInitials,
  emblemSpec,
  stableHash,
} from '@/components/club-emblem';

describe('emblema genérico de clube', () => {
  it('é determinístico: o mesmo clube sempre gera o mesmo emblema', () => {
    const first = emblemSpec({ name: 'Flamengo' });
    expect(emblemSpec({ name: 'Flamengo' })).toEqual(first);
    expect(emblemSpec({ name: '  flamengo ' })).toEqual({
      ...first,
      initials: 'FLA',
    });
    expect(stableHash('club_flamengo')).toBe(stableHash('club_flamengo'));
  });

  it('usa o id como semente quando existir', () => {
    const byId = emblemSpec({ id: 'club_42', name: 'Clube A' });
    expect(emblemSpec({ id: 'club_42', name: 'Clube A' })).toEqual(byId);
    expect(emblemSpec({ id: 'club_43', name: 'Clube A' })).not.toEqual(byId);
  });

  it('diferencia clubes diferentes e respeita cores do catálogo', () => {
    const names = ['Flamengo', 'Palmeiras', 'Fluminense', 'Atlético Mineiro'];
    const specs = names.map((name) => emblemSpec({ name }));
    expect(new Set(specs.map((spec) => spec.primary)).size).toBe(names.length);
    const colored = emblemSpec({
      name: 'Bahia',
      colors: { primary: '#1d4ed8', secondary: '#dc2626' },
    });
    expect(colored.primary).toBe('#1d4ed8');
    expect(colored.secondary).toBe('#dc2626');
  });

  it('gera iniciais legíveis sem artigos', () => {
    expect(clubInitials('Flamengo')).toBe('FLA');
    expect(clubInitials('Atlético Mineiro')).toBe('AM');
    expect(clubInitials('Vasco da Gama')).toBe('VG');
    expect(clubInitials('Red Bull Bragantino')).toBe('RBB');
  });

  it('renderiza o mesmo desenho e expõe rótulo acessível', () => {
    const { container, rerender } = render(<ClubEmblem name="Palmares" />);
    const svg = screen.getByRole('img', { name: 'Emblema do Palmares' });
    const shape = svg.getAttribute('data-shape');
    const pattern = svg.getAttribute('data-pattern');
    expect(svg.textContent).toBe('PAL');
    rerender(<ClubEmblem name="Palmares" />);
    const again = screen.getByRole('img', { name: 'Emblema do Palmares' });
    expect(again.getAttribute('data-shape')).toBe(shape);
    expect(again.getAttribute('data-pattern')).toBe(pattern);
    rerender(<ClubEmblem name="Palmares" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('usa o escudo pixel quando o clube tem um, inclusive pelo id do catálogo', () => {
    const { rerender } = render(<ClubEmblem name="São Paulo" />);
    const crest = screen.getByRole('img', { name: 'Escudo do São Paulo' });
    expect(crest.getAttribute('src')).toBe('/crests/club_sao_paulo.png');
    rerender(<ClubEmblem name="Qualquer" id="club_flamengo" />);
    expect(
      screen
        .getByRole('img', { name: 'Escudo do Qualquer' })
        .getAttribute('src'),
    ).toBe('/crests/club_flamengo.png');
  });
});
