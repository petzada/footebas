import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthCallback } from '@/components/auth-callback';
import { CareerGame } from '@/components/career-game';
import { InMemoryCareerApi } from '@/lib/career-api';
import { FakeAuth } from '@/lib/fake-auth';
import { SessionExpiredError } from '@/lib/http-career-api';

const player = { id: 'user-1', email: 'ana@footebas.com', name: 'Ana' };

async function careerReady() {
  const api = new InMemoryCareerApi();
  await api.login(player.email);
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  return api;
}

describe('entrada com conta', () => {
  it('sem sessão mostra a tela de entrada, sem o jogo', async () => {
    render(<CareerGame api={new InMemoryCareerApi()} auth={new FakeAuth()} />);
    expect(
      await screen.findByRole('button', { name: /entrar com google/i }),
    ).toBeTruthy();
    expect(screen.getByLabelText(/seu e-mail/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /jogar partida/i })).toBeNull();
  });

  it('envia o link mágico pelo port e pede para conferir o e-mail', async () => {
    const auth = new FakeAuth();
    render(<CareerGame api={new InMemoryCareerApi()} auth={auth} />);
    fireEvent.change(await screen.findByLabelText(/seu e-mail/i), {
      target: { value: ' ana@footebas.com ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /enviar link mágico/i }),
    );
    const heading = await screen.findByRole('heading', {
      name: /confira seu e-mail/i,
    });
    expect(auth.calls.magicLinks).toEqual(['ana@footebas.com']);
    expect(screen.getByRole('status').textContent).toMatch('ana@footebas.com');
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('explica e-mail inválido sem chamar o port', async () => {
    const auth = new FakeAuth();
    render(<CareerGame api={new InMemoryCareerApi()} auth={auth} />);
    const input = await screen.findByLabelText(/seu e-mail/i);
    fireEvent.change(input, { target: { value: 'ana' } });
    fireEvent.click(
      screen.getByRole('button', { name: /enviar link mágico/i }),
    );
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /e-mail válido/i,
    );
    expect(auth.calls.magicLinks).toEqual([]);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('mostra o erro legível quando o Google falha', async () => {
    const auth = new FakeAuth();
    auth.failWith = 'Esse jeito de entrar está desativado no momento.';
    render(<CareerGame api={new InMemoryCareerApi()} auth={auth} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /entrar com google/i }),
    );
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /desativado/i,
    );
    expect(auth.calls.google).toBe(1);
  });

  it('com sessão mostra o Início, carrega a carreira e permite sair', async () => {
    const auth = new FakeAuth({ user: player });
    render(<CareerGame api={await careerReady()} auth={auth} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /e aí, ana/i }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /carregar carreira/i }));
    fireEvent.click(
      await screen.findByRole('button', { name: /abrir carreira de ana/i }),
    );
    expect(
      await screen.findByRole('button', { name: /jogar partida/i }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^sair$/i }));
    expect(
      await screen.findByRole('button', { name: /entrar com google/i }),
    ).toBeTruthy();
    expect(auth.calls.signOut).toBe(1);
  });

  it('com sessão começa uma nova carreira pelo Início', async () => {
    const auth = new FakeAuth({ user: player });
    render(<CareerGame api={new InMemoryCareerApi()} auth={auth} />);
    fireEvent.click(
      await screen.findByRole('button', { name: /nova carreira/i }),
    );
    expect(
      await screen.findByRole('heading', { name: /como você quer jogar/i }),
    ).toBeTruthy();
    expect(screen.getByText(/nova carreira · 1 de 6/i)).toBeTruthy();
  });

  it('volta para a entrada quando a sessão expira', async () => {
    const api = new InMemoryCareerApi();
    api.login = async () => {
      throw new SessionExpiredError();
    };
    const auth = new FakeAuth({ user: player });
    render(<CareerGame api={api} auth={auth} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /sessão expirou/i,
    );
    expect(
      screen.getByRole('button', { name: /entrar com google/i }),
    ).toBeTruthy();
  });
});

describe('/auth/callback', () => {
  it('conclui o login e volta para o início', async () => {
    const visited: string[] = [];
    render(
      <AuthCallback
        auth={new FakeAuth()}
        navigate={(to) => visited.push(to)}
      />,
    );
    expect(screen.getByRole('status').textContent).toMatch(/confirmando/i);
    await waitFor(() => expect(visited).toEqual(['/']));
  });

  it('mostra o erro em português quando o link falha', async () => {
    const auth = new FakeAuth();
    auth.failWith = 'O link expirou ou já foi usado. Peça um novo.';
    render(<AuthCallback auth={auth} navigate={() => undefined} />);
    expect((await screen.findByRole('alert')).textContent).toMatch(/expirou/i);
  });
});
