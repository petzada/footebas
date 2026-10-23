import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InboxScreen } from '@/components/inbox-screen';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';
import { createFakeInboxPort, demoInboxView } from '@/lib/inbox-product';

async function setup() {
  const api = new InMemoryCareerApi();
  await api.login('ana@footebas.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  const base = (await api.getCareer())!;
  // As the HTTP adapter delivers it: the inbox messages are also news items
  // (same ids), plus one career milestone outside the inbox.
  const career: CareerView = {
    ...base,
    world: {
      ...base.world,
      news: [
        {
          id: 'msg_board_reinforcement',
          tag: 'Diretoria',
          headline: 'A diretoria quer saber do reforço',
          detail: 'Buscar um meia agora ou poupar o caixa?',
          date: '2026-02-09',
          pending: true,
          unread: true,
        },
        {
          id: 'msg_report',
          tag: 'Relatório',
          headline: 'Vitória sólida sobre o Palmeiras',
          detail: '2 a 0.',
          date: '2026-02-07',
          deletable: true,
        },
        {
          id: 'news_promotion',
          tag: 'Carreira',
          headline: 'Flamengo garante vaga na Libertadores',
          detail: 'A campanha do returno fez a diferença.',
          date: '2026-02-06',
          deletable: true,
        },
      ],
    },
  };
  const port = createFakeInboxPort(demoInboxView());
  const remove = vi.spyOn(port, 'remove');
  const onCareerChange = vi.fn();
  const reportError = vi.fn();
  render(
    <InboxScreen
      career={career}
      api={api}
      port={port}
      navigate={() => undefined}
      onCareerChange={onCareerChange}
      reportError={reportError}
    />,
  );
  return { port, remove, onCareerChange, reportError };
}

describe('Caixa de entrada como tela própria (D6)', () => {
  it('lista todas as mensagens, pendentes primeiro, sem o "Ver todas" da Central', async () => {
    await setup();
    const messages = await screen.findByRole('region', { name: /mensagens/i });
    const items = within(messages).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0]!.textContent).toMatch(/diretoria quer saber/i);
    expect(items[1]!.textContent).toMatch(/gerson pede mais minutos/i);
    expect(
      within(messages).queryByRole('button', { name: /ver todas/i }),
    ).toBeNull();
    expect(
      screen.getByRole('heading', { name: /caixa de entrada/i }),
    ).toBeTruthy();
  });

  it('a lixeira só aparece no que não espera decisão', async () => {
    await setup();
    const messages = await screen.findByRole('region', { name: /mensagens/i });
    const trashes = within(messages).getAllByRole('button', {
      name: /^excluir:/i,
    });
    expect(trashes.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Excluir: Coletiva: pressão por título',
      'Excluir: Vitória sólida sobre o Palmeiras',
    ]);
    // 44px touch targets (docs/07 §3).
    for (const button of trashes) expect(button.className).toMatch(/size-11/);
  });

  it('Notícias mostra só o que não é mensagem da caixa e exclui pela lixeira', async () => {
    const { remove, onCareerChange } = await setup();
    await screen.findByRole('region', { name: /mensagens/i });
    const news = await screen.findByRole('region', { name: /notícias/i });
    const list = within(news).getByRole('list', {
      name: /notícias da carreira/i,
    });
    await waitFor(() =>
      expect(within(list).getAllByRole('listitem')).toHaveLength(1),
    );
    expect(list.textContent).toMatch(/vaga na libertadores/i);
    expect(list.textContent).not.toMatch(/diretoria quer saber/i);
    fireEvent.click(
      within(list).getByRole('button', { name: /excluir: flamengo garante/i }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith('news_promotion'));
    await waitFor(() => expect(onCareerChange).toHaveBeenCalled());
  });
});
