import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CareerGame } from '@/components/career-game';
import { completeNewCareer } from '@/components/testing/complete-new-career';
import { InMemoryCareerApi } from '@/lib/career-api';

async function onboard(api = new InMemoryCareerApi()) {
  render(<CareerGame api={api} />);
  fireEvent.click(screen.getByRole('button', { name: /entrar no vestiário/i }));
  fireEvent.click(
    await screen.findByRole('button', { name: /nova carreira/i }),
  );
  await completeNewCareer();
  await screen.findByRole('button', { name: /jogar partida/i });
  return api;
}

afterEach(() => vi.useRealTimers());

describe('elenco e matchday mobile-first', () => {
  it('chega à rodada em poucos toques, pula o feed e prepara a próxima', async () => {
    await onboard();
    fireEvent.click(screen.getByRole('button', { name: /jogar partida/i }));
    fireEvent.click(
      await screen.findByRole('button', { name: /pular resultado/i }),
    );
    expect(await screen.findByText(/fim de jogo/i)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /preparar próxima rodada/i }),
    );
    expect((await screen.findAllByText(/rodada 2/i)).length).toBeGreaterThan(0);
  });

  it('oferece alternativa ao arrastar: selecionar e escolher o destino pelo teclado', async () => {
    await onboard();
    fireEvent.click(screen.getAllByRole('button', { name: /elenco/i })[0]!);
    expect(
      await screen.findByText(/arraste um jogador ou toque nele/i),
    ).toBeTruthy();
    const player = screen.getByRole('button', {
      name: /lateral direito: emerson royal/i,
    });
    player.focus();
    fireEvent.click(player);
    expect(player.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('status').textContent).toMatch(/selecionado/i);
    fireEvent.click(
      screen.getByRole('button', {
        name: /mandar emerson royal para o banco/i,
      }),
    );
    expect(
      screen.getByRole('button', { name: /^emerson royal, ld.*no banco/i }),
    ).toBeTruthy();
  });

  it('expõe feedback acessível para escalação pendente', async () => {
    await onboard();
    fireEvent.click(screen.getAllByRole('button', { name: /elenco/i })[0]!);
    fireEvent.click(
      await screen.findByRole('button', { name: /goleiro: agustín rossi/i }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /mandar agustín rossi para as reservas/i,
      }),
    );
    expect(
      screen.getByRole('list', { name: /pendências da escalação/i })
        .textContent,
    ).toMatch(/faltam 1 titular/i);
  });

  it('mostra preparação, controles de velocidade, feed e skip em um toque', async () => {
    await onboard();
    expect(screen.getByText(/raio-x do rival/i)).toBeTruthy();
    expect(screen.getByText('≈ 82')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /jogar partida/i }));
    expect(await screen.findByLabelText(/velocidade 4 vezes/i)).toBeTruthy();
    expect(
      screen.getByRole('list', { name: /feed da partida/i }).textContent,
    ).toMatch(/bola rolando/i);
    expect(
      screen.getByRole('button', { name: /pular resultado/i }),
    ).toBeTruthy();
  });

  it('aplica escalação automática e mantém até duas características visíveis', async () => {
    const api = await onboard();
    fireEvent.click(screen.getAllByRole('button', { name: /elenco/i })[0]!);
    fireEvent.click(await screen.findByRole('button', { name: /^poupar$/i }));
    await waitFor(async () => {
      const career = await api.getCareer();
      expect(
        career?.players.filter((player) => player.role === 'starter'),
      ).toHaveLength(11);
      expect(
        career?.players.filter(
          (player) =>
            player.role === 'starter' && player.primaryPosition === 'GOL',
        ),
      ).toHaveLength(1);
      expect(career?.players.every((player) => player.traits.length <= 2)).toBe(
        true,
      );
    });
  });

  it('expõe a tática compacta completa e salva a formação', async () => {
    const api = await onboard();
    fireEvent.click(screen.getAllByRole('button', { name: /táticas/i })[0]!);
    for (const label of [
      'Formação',
      'Mentalidade',
      'Construção',
      'Foco ofensivo',
      'Pressão',
      'Linha defensiva',
      'Marcação',
    ]) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('radio', { name: '4-4-2' }));
    fireEvent.click(screen.getByRole('button', { name: /salvar tática/i }));
    await waitFor(async () =>
      expect((await api.getCareer())?.formation).toBe('4-4-2'),
    );
  });
});

describe('CareerApiPort autoritativo', () => {
  it('rejeita escalação inválida sem escrita direta no snapshot', async () => {
    const api = new InMemoryCareerApi();
    await api.login('a@b.com');
    await api.createCareer({ coach: 'Ana' });
    await api.selectClub('Flamengo');
    const before = await api.getCareer();
    (before!.players[0] as { name: string }).name = 'alteração indevida';
    expect((await api.getCareer())!.players[0]!.name).toBe('Agustín Rossi');
    await api.setPlayerRole('fla-22', 'reserve');
    await expect(api.validateMatchday()).rejects.toThrow(
      /escolha 11 titulares/i,
    );
  });

  it('registra substituições e mudanças táticas em ponto discreto', async () => {
    const api = new InMemoryCareerApi();
    await api.login('a@b.com');
    await api.createCareer({ coach: 'Bia' });
    await api.selectClub('Flamengo');
    await api.beginMatch();
    await expect(
      api.makeSubstitution({ outgoingId: 'fla-22', incomingId: 'fla-13' }),
    ).rejects.toThrow(/pausas/i);
    await api.nextMatchEvent();
    await api.nextMatchEvent();
    const pause = await api.nextMatchEvent();
    expect(pause.decisionPoint).toBe(true);
    await api.makeSubstitution({ outgoingId: 'fla-22', incomingId: 'fla-13' });
    await api.changeMatchTactics({ mentality: 'attacking' });
    const finished = await api.finishMatch();
    expect(finished.lastResult?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'substitution' }),
        expect.objectContaining({ type: 'tactics' }),
      ]),
    );
  });

  it('produz resultado instantâneo completo', async () => {
    vi.useFakeTimers();
    const api = new InMemoryCareerApi();
    await api.login('a@b.com');
    await api.createCareer({ coach: 'Caio' });
    await api.selectClub('Flamengo');
    const result = await api.instantResult();
    expect(result.round).toBe(2);
    expect(result.lastResult?.events.at(-1)?.done).toBe(true);
    await act(async () => vi.runAllTimersAsync());
  });
});
