import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CLUB_AREAS, ClubMapScreen } from '@/components/club-map';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';

async function career(): Promise<CareerView> {
  const api = new InMemoryCareerApi();
  await api.login('ana@footebas.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  return (await api.getCareer())!;
}

describe('Mapa do clube', () => {
  it('cada área da ilustração é um botão real que navega', async () => {
    const navigate = vi.fn();
    render(
      <ClubMapScreen
        career={await career()}
        navigate={navigate}
        onNarrate={() => undefined}
        onInstant={() => undefined}
      />,
    );
    const map = screen.getByRole('navigation', { name: 'Áreas do mapa' });
    const expected = [
      ['CT: Elenco e Táticas', 'squad'],
      ['Estádio: Estádio e Partida', 'stadium'],
      ['Sede: Escritório e Finanças', 'office'],
      ['Imprensa: Notícias', 'inbox'],
      ['Estacionamento: Mercado', 'market'],
      ['Casa do treinador: Carreira e histórico', 'history'],
    ] as const;
    expect(within(map).getAllByRole('button')).toHaveLength(expected.length);
    for (const [label, destination] of expected) {
      const area = within(map).getByRole('button', { name: label });
      area.focus();
      expect(document.activeElement).toBe(area);
      fireEvent.click(area);
      expect(navigate).toHaveBeenLastCalledWith(destination);
    }
  });

  it('oferece a mesma navegação em lista, sem depender da ilustração', async () => {
    const navigate = vi.fn();
    render(
      <ClubMapScreen
        career={await career()}
        navigate={navigate}
        onNarrate={() => undefined}
        onInstant={() => undefined}
      />,
    );
    const list = screen.getByRole('navigation', {
      name: 'Áreas do clube em lista',
    });
    for (const area of CLUB_AREAS) {
      const item = within(list)
        .getByRole('heading', { name: area.name })
        .closest('li')!;
      for (const [destination, label] of area.links) {
        fireEvent.click(within(item).getByRole('button', { name: label }));
        expect(navigate).toHaveBeenLastCalledWith(destination);
      }
    }
  });

  it('nunca bloqueia avançar: jogar e resultado instantâneo ficam no topo', async () => {
    const onNarrate = vi.fn();
    const onInstant = vi.fn();
    render(
      <ClubMapScreen
        career={await career()}
        navigate={() => undefined}
        onNarrate={onNarrate}
        onInstant={onInstant}
      />,
    );
    const bar = screen.getByRole('region', { name: /avançar no calendário/i });
    expect(bar.textContent).toMatch(/flamengo × palmeiras/i);
    fireEvent.click(
      within(bar).getByRole('button', { name: /jogar partida/i }),
    );
    fireEvent.click(
      within(bar).getByRole('button', { name: /resultado instantâneo/i }),
    );
    expect(onNarrate).toHaveBeenCalledTimes(1);
    expect(onInstant).toHaveBeenCalledTimes(1);
  });
});
