import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CareerGame } from '@/components/career-game';
import { InMemoryCareerApi } from '@/lib/career-api';

async function onboard() {
  fireEvent.click(screen.getByRole('button', { name: /entrar no vestiário/i }));
  await screen.findByLabelText(/nome do treinador/i);
  fireEvent.click(screen.getByRole('button', { name: /conhecer os clubes/i }));
  await screen.findByText(/escolha seu desafio/i);
  fireEvent.click(screen.getByRole('button', { name: /atlético aurora/i }));
  await screen.findByRole('button', { name: /avançar partida/i });
}

describe('carreira mobile-first', () => {
  it('chega ao primeiro jogo em poucos passos e pula o feed', async () => {
    render(<CareerGame api={new InMemoryCareerApi()} />);
    await onboard();
    fireEvent.click(screen.getByRole('button', { name: /avançar partida/i }));
    fireEvent.click(
      await screen.findByRole('button', { name: /pular para o resultado/i }),
    );
    expect(await screen.findByText(/fim de jogo/i)).toBeTruthy();
  });
  it('navega por elenco, tática e tabela', async () => {
    render(<CareerGame api={new InMemoryCareerApi()} />);
    await onboard();
    fireEvent.click(screen.getAllByRole('button', { name: /elenco/i })[0]!);
    expect(await screen.findByText(/elenco principal/i)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /táticas/i })[0]!);
    expect(await screen.findByText(/prancheta/i)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /tabela/i })[0]!);
    expect(await screen.findByText(/classificação/i)).toBeTruthy();
  });
  it('persiste somente por comandos do port e devolve cópias', async () => {
    vi.useFakeTimers();
    const api = new InMemoryCareerApi();
    await api.login('a@b.com');
    await api.createCareer({ coach: 'Ana' });
    await api.selectClub('Atlético Aurora');
    const before = await api.getCareer();
    expect(before).not.toBeNull();
    (before!.players[0] as { name: string }).name = 'alteração indevida';
    expect((await api.getCareer())!.players[0]!.name).toBe('Caio Ventura');
    const task = api.advanceMatch(() => undefined);
    await vi.runAllTimersAsync();
    await task;
    expect((await api.getCareer())!.round).toBe(2);
    vi.useRealTimers();
  });
  it('recarrega a visão da carreira existente', async () => {
    const api = new InMemoryCareerApi();
    await api.login('a@b.com');
    await api.createCareer({ coach: 'Bia' });
    await api.selectClub('Esporte Litorâneo');
    render(<CareerGame api={api} />);
    fireEvent.change(screen.getByLabelText(/seu e-mail/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /entrar no vestiário/i }),
    );
    await waitFor(() => expect(screen.getByText(/olá, bia/i)).toBeTruthy());
  });
});
