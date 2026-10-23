import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CareerGame } from '@/components/career-game';
import { LoadCareerScreen, StartScreen } from '@/components/start-screens';
import { completeNewCareer } from '@/components/testing/complete-new-career';
import { InMemoryCareerApi } from '@/lib/career-api';

const player = { name: 'Ana' };

async function careerFor(api: InMemoryCareerApi, coach: string) {
  await api.login('ana@footebas.com');
  await api.createCareer({ coach });
  await api.selectClub('Flamengo');
}

describe('Início', () => {
  it('mostra avatar, ações e contadores vindos do endpoint', async () => {
    const onNew = vi.fn();
    const onLoad = vi.fn();
    render(
      <StartScreen
        player={player}
        loadStats={async () => ({ coaches: 1234, clubs: 98, athletes: 2560 })}
        onNewCareer={onNew}
        onLoadCareer={onLoad}
      />,
    );
    expect(screen.getByRole('img', { name: /avatar de ana/i })).toBeTruthy();
    const counters = await screen.findByRole('region', {
      name: /no gramado agora/i,
    });
    expect(within(counters).getByText('1.234')).toBeTruthy();
    expect(within(counters).getByText('treinadores')).toBeTruthy();
    expect(within(counters).getByText('98')).toBeTruthy();
    expect(within(counters).getByText('clubes')).toBeTruthy();
    expect(within(counters).getByText('2.560')).toBeTruthy();
    expect(within(counters).getByText('atletas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /nova carreira/i }));
    fireEvent.click(screen.getByRole('button', { name: /carregar carreira/i }));
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('esconde os contadores quando o endpoint não existe ou falha', async () => {
    const missing = vi.fn(async () => null);
    const { unmount } = render(
      <StartScreen
        player={player}
        loadStats={missing}
        onNewCareer={() => undefined}
        onLoadCareer={() => undefined}
      />,
    );
    await waitFor(() => expect(missing).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: /no gramado/i })).toBeNull();
    unmount();
    const failing = vi.fn(async () => {
      throw new Error('404');
    });
    render(
      <StartScreen
        player={player}
        loadStats={failing}
        onNewCareer={() => undefined}
        onLoadCareer={() => undefined}
      />,
    );
    await waitFor(() => expect(failing).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: /no gramado/i })).toBeNull();
    expect(screen.getByRole('button', { name: /nova carreira/i })).toBeTruthy();
  });

  it('mostra a última carreira com nome, avatar e personalidade do treinador', async () => {
    const api = new InMemoryCareerApi();
    await api.login('ana@footebas.com');
    await api.createCareer({
      coach: 'Ana',
      careerName: 'Rumo ao tri',
      coachProfile: {
        nationality: 'BR',
        avatar: 'avatar-09',
        personality: 'motivador',
      },
    });
    await api.selectClub('Flamengo');
    const onContinue = vi.fn();
    render(
      <StartScreen
        player={player}
        loadStats={async () => null}
        loadCareers={() => api.listCareers()}
        onNewCareer={() => undefined}
        onLoadCareer={() => undefined}
        onContinue={onContinue}
      />,
    );
    const latest = await screen.findByRole('region', { name: 'Rumo ao tri' });
    expect(latest.textContent).toMatch(/motivador/i);
    expect(latest.textContent).toMatch(/flamengo/i);
    expect(
      within(latest).getByRole('img', { name: /avatar do treinador ana/i }),
    ).toBeTruthy();
    expect(latest.querySelector('[data-avatar="avatar-09"]')).not.toBeNull();
    fireEvent.click(
      within(latest).getByRole('button', { name: /continuar rumo ao tri/i }),
    );
    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Rumo ao tri' }),
    );
  });

  it('no port local usa os números do catálogo', async () => {
    render(<CareerGame api={new InMemoryCareerApi()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /entrar no vestiário/i }),
    );
    const counters = await screen.findByRole('region', {
      name: /no gramado agora/i,
    });
    expect(within(counters).getByText('atletas')).toBeTruthy();
    expect(within(counters).getByText('20')).toBeTruthy();
  });
});

describe('Carregar Carreira', () => {
  it('lista as carreiras com clube, temporada e última atualização e abre', async () => {
    const api = new InMemoryCareerApi({
      careerLimit: 5,
      now: () => new Date('2026-10-20T15:30:00.000Z'),
    });
    await careerFor(api, 'Ana');
    const onOpen = vi.fn();
    render(
      <LoadCareerScreen
        load={() => api.listCareers()}
        remove={(id) => api.deleteCareer(id)}
        onOpen={onOpen}
        onNewCareer={() => undefined}
        onBack={() => undefined}
      />,
    );
    const list = await screen.findByRole('list', { name: /suas carreiras/i });
    const item = within(list).getByRole('listitem');
    expect(within(item).getByText('Carreira de Ana')).toBeTruthy();
    expect(within(item).getByText(/flamengo · ana/i)).toBeTruthy();
    expect(within(item).getByText(/temporada 2026/i)).toBeTruthy();
    expect(within(item).getByText(/atualizada em/i)).toBeTruthy();
    expect(item.querySelector('[data-testid="club-emblem"]')).not.toBeNull();
    expect(screen.getByText(/1 de 5 carreiras/i)).toBeTruthy();
    fireEvent.click(
      within(item).getByRole('button', { name: /abrir carreira de ana/i }),
    );
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ coach: 'Ana', clubName: 'Flamengo' }),
    );
  });

  it('mostra o estado vazio e o aviso do plano', async () => {
    const onNew = vi.fn();
    render(
      <LoadCareerScreen
        load={async () => ({ careers: [] })}
        remove={async () => undefined}
        onOpen={() => undefined}
        onNewCareer={onNew}
        onBack={() => undefined}
      />,
    );
    expect(await screen.findByText(/nenhuma carreira salva/i)).toBeTruthy();
    expect(screen.getByText(/plano grátis: 1 carreira/i)).toBeTruthy();
    expect(screen.getByText(/licença única: até 5/i)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: /começar nova carreira/i }),
    );
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('só exclui depois da confirmação', async () => {
    const api = new InMemoryCareerApi();
    await careerFor(api, 'Bia');
    const remove = vi.fn((id: string) => api.deleteCareer(id));
    render(
      <LoadCareerScreen
        load={() => api.listCareers()}
        remove={remove}
        onOpen={() => undefined}
        onNewCareer={() => undefined}
        onBack={() => undefined}
      />,
    );
    const askDelete = await screen.findByRole('button', {
      name: /excluir carreira de bia/i,
    });
    fireEvent.click(askDelete);
    const dialog = screen.getByRole('alertdialog', {
      name: /excluir carreira\?/i,
    });
    expect(dialog.textContent).toMatch(/não pode ser desfeita/i);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: /cancelar/i }),
      ),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: /cancelar/i }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(askDelete);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(askDelete);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: /sim, excluir carreira/i,
      }),
    );
    expect(await screen.findByText(/nenhuma carreira salva/i)).toBeTruthy();
    expect(remove).toHaveBeenCalledTimes(1);
    expect((await api.listCareers()).careers).toHaveLength(0);
  });

  it('leva ao Carregar com a mensagem quando o plano recusa outra carreira', async () => {
    render(<CareerGame api={new InMemoryCareerApi()} />);
    fireEvent.click(
      screen.getByRole('button', { name: /entrar no vestiário/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /nova carreira/i }),
    );
    await completeNewCareer();
    fireEvent.click(
      await screen.findByRole('button', { name: /voltar ao início/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /nova carreira/i }),
    );
    await completeNewCareer({ coach: 'Bia' });
    expect(
      await screen.findByRole('heading', { name: /carregar carreira/i }),
    ).toBeTruthy();
    expect(
      (await screen.findAllByRole('alert'))
        .map((node) => node.textContent)
        .join(' '),
    ).toMatch(/plano grátis permite 1 carreira/i);
  });
});
