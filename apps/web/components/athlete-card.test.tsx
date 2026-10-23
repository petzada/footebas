import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AthleteCard, potentialBand } from '@/components/athlete-card';
import { InMemoryCareerApi, type PlayerView } from '@/lib/career-api';

async function players(): Promise<readonly PlayerView[]> {
  const api = new InMemoryCareerApi();
  await api.login('ana@footebas.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  return (await api.getCareer())!.players;
}

describe('cartão de figurinha do atleta', () => {
  it('potencial é uma faixa estimada, nunca um número exato', () => {
    const band = potentialBand(70, 'alto', 20);
    expect(band.min).toBeLessThan(band.max);
    expect(band.min).toBeGreaterThanOrEqual(70);
    expect(band.max).toBeLessThanOrEqual(99);
    const veteran = potentialBand(70, 'alto', 34);
    expect(veteran.max).toBeLessThan(band.max);
    expect(potentialBand(97, 'alto', 19).max).toBe(99);
    expect(potentialBand(3, 'limitado', 19).min).toBe(1);
    expect(potentialBand(70, 'alto', 20)).toEqual(band);
  });

  it('mostra avatar pixel, posição, força em barra, selos e faixa de potencial', async () => {
    const [player] = await players();
    render(<AthleteCard player={player!} club={{ name: 'Flamengo' }} />);
    const card = screen.getByRole('article', {
      name: new RegExp(`${player!.name}, ${player!.primaryPosition}`),
    });
    expect(
      card.querySelector(`img[data-avatar-seed="atleta-${player!.id}"]`),
    ).not.toBeNull();
    expect(card.textContent).toContain(`#${player!.shirt}`);
    expect(
      within(card).getByLabelText(`Força: ${player!.strength}`),
    ).toBeTruthy();
    const potential = within(card).getByLabelText(/faixa estimada entre/i);
    const min = Number(potential.getAttribute('data-potential-min'));
    const max = Number(potential.getAttribute('data-potential-max'));
    expect(min).toBeLessThan(max);
    expect(potential.textContent).toMatch(new RegExp(`≈ ${min}–${max}`));
    expect(potential.textContent).toMatch(/estimativa/i);
    expect(card.textContent).not.toMatch(/potencial:?\s*\d+\b/i);
    if (player!.traits.length > 0)
      expect(
        within(
          within(card).getByRole('list', { name: 'Características' }),
        ).getAllByRole('listitem').length,
      ).toBeGreaterThan(0);
  });

  it('avisa suspensão e lesão', async () => {
    const [player] = await players();
    const injured = { ...player!, injuryRounds: 2 };
    const { rerender } = render(
      <AthleteCard player={injured} club={{ name: 'Flamengo' }} compact />,
    );
    expect(screen.getByText(/lesionado · 2 rodada/i)).toBeTruthy();
    rerender(
      <AthleteCard
        player={{ ...player!, suspended: true }}
        club={{ name: 'Flamengo' }}
      />,
    );
    expect(screen.getByText(/suspenso/i)).toBeTruthy();
  });
});
