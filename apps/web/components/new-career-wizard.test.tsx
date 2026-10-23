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
import { NewCareerWizard } from '@/components/new-career-wizard';
import { completeNewCareer } from '@/components/testing/complete-new-career';
import { InMemoryCareerApi } from '@/lib/career-api';

const next = () =>
  fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));

function renderWizard(onSubmit = vi.fn(), onCancel = vi.fn()) {
  render(<NewCareerWizard onSubmit={onSubmit} onCancel={onCancel} />);
  return { onSubmit, onCancel };
}

describe('Nova Carreira em cinco etapas', () => {
  it('percorre modo → universo → clube → treinador → nome e envia o perfil', async () => {
    const { onSubmit } = renderWizard();
    const progress = () =>
      screen.getByRole('progressbar', { name: /etapa \d de 5/i });

    expect(screen.getByText(/nova carreira · 1 de 5/i)).toBeTruthy();
    expect(progress().getAttribute('aria-label')).toMatch(
      /etapa 1 de 5: modo/i,
    );
    expect(
      screen.getByRole('radio', { name: /modo treinador/i }),
    ).toHaveProperty('checked', true);
    next();

    expect(await screen.findByRole('heading', { name: /onde vai ser/i })).toBe(
      document.activeElement,
    );
    expect(progress().getAttribute('aria-label')).toMatch(/2 de 5: universo/i);
    next();

    await screen.findByRole('heading', { name: /escolha seu clube/i });
    fireEvent.click(screen.getByRole('radio', { name: /fluminense/i }));
    const squad = screen.getByRole('region', { name: /elenco do fluminense/i });
    for (const group of [
      'Goleiros',
      'Defensores',
      'Meio-campistas',
      'Atacantes',
    ])
      expect(within(squad).getByText(group)).toBeTruthy();
    expect(
      within(squad).getAllByText(/craque|destaque/i).length,
    ).toBeGreaterThan(0);
    next();

    await screen.findByRole('heading', { name: /quem é o treinador/i });
    fireEvent.change(screen.getByLabelText(/nome do treinador/i), {
      target: { value: '  Marcio  ' },
    });
    fireEvent.change(screen.getByLabelText(/buscar país/i), {
      target: { value: 'portu' },
    });
    const countries = screen.getByRole('listbox', { name: /^país$/i });
    expect(
      within(countries)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/portugal/i)]));
    fireEvent.change(countries, { target: { value: 'PT' } });
    expect(
      screen.getByText(/selecionada:/i).parentElement?.textContent,
    ).toMatch(/portugal/i);
    fireEvent.click(screen.getByRole('radio', { name: 'Avatar 7' }));
    fireEvent.click(screen.getByRole('radio', { name: /^diplomata/i }));
    next();

    await screen.findByRole('heading', { name: /dê um nome à carreira/i });
    const name = screen.getByLabelText(/nome da carreira/i);
    expect((name as HTMLInputElement).value).toBe('Carreira de Marcio');
    fireEvent.change(name, { target: { value: 'Rumo ao topo' } });
    const summary = screen.getByRole('region', { name: /resumo/i });
    expect(summary.textContent).toMatch(/marcio/i);
    expect(summary.textContent).toMatch(/portugal/i);
    expect(summary.textContent).toMatch(/diplomata/i);
    expect(summary.textContent).toMatch(/fluminense/i);
    fireEvent.click(screen.getByRole('button', { name: /começar carreira/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      club: 'Fluminense',
      coach: 'Marcio',
      careerName: 'Rumo ao topo',
      coachProfile: {
        nationality: 'PT',
        avatar: 'avatar-07',
        personality: 'diplomata',
      },
    });
  });

  it('mostra "Continente inteiro" com selo em breve e bloqueado', async () => {
    renderWizard();
    next();
    await screen.findByRole('heading', { name: /onde vai ser/i });
    const brasil = screen.getByRole('radio', { name: /só brasil/i });
    const continent = screen.getByRole('radio', {
      name: /continente inteiro/i,
    });
    expect(brasil).toHaveProperty('checked', true);
    expect(continent).toHaveProperty('disabled', true);
    expect(continent.getAttribute('aria-describedby')).toBeTruthy();
    expect(continent.closest('label')?.textContent).toMatch(/em breve/i);
    fireEvent.click(continent);
    expect(continent).toHaveProperty('checked', false);
    expect(brasil).toHaveProperty('checked', true);
  });

  it('valida clube, treinador e nome da carreira em português', async () => {
    const { onSubmit } = renderWizard();
    next();
    next();
    await screen.findByRole('heading', { name: /escolha seu clube/i });
    next();
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /escolha um clube/i,
    );
    fireEvent.click(screen.getByRole('radio', { name: /flamengo/i }));
    next();

    await screen.findByRole('heading', { name: /quem é o treinador/i });
    next();
    const coach = screen.getByLabelText(/nome do treinador/i);
    expect(coach.getAttribute('aria-invalid')).toBe('true');
    const alerts = screen.getAllByRole('alert').map((node) => node.textContent);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/informe o nome do treinador/i),
        expect.stringMatching(/escolha a personalidade/i),
      ]),
    );
    fireEvent.change(coach, { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('radio', { name: /^motivador/i }));
    next();

    await screen.findByRole('heading', { name: /dê um nome à carreira/i });
    const name = screen.getByLabelText(/nome da carreira/i);
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /começar carreira/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /dê um nome à carreira/i,
    );
    expect(name.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(name, { target: { value: 'x'.repeat(41) } });
    expect(screen.getByText(/41\/40 caracteres/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /começar carreira/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /no máximo 40 caracteres/i,
    );
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(name, { target: { value: 'x'.repeat(40) } });
    fireEvent.click(screen.getByRole('button', { name: /começar carreira/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ careerName: 'x'.repeat(40) }),
    );
  });

  it('volta etapa a etapa sem perder as escolhas e cancela na primeira', async () => {
    const { onCancel } = renderWizard();
    next();
    next();
    await screen.findByRole('heading', { name: /escolha seu clube/i });
    fireEvent.click(screen.getByRole('radio', { name: /atlético mineiro/i }));
    next();
    await screen.findByRole('heading', { name: /quem é o treinador/i });
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    expect(
      screen.getByRole('radio', { name: /atlético mineiro/i }),
    ).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    fireEvent.click(screen.getByRole('button', { name: /voltar ao início/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('funciona só com teclado: Enter avança e o foco vai para o título', async () => {
    renderWizard();
    const mode = screen.getByRole('radio', { name: /modo treinador/i });
    mode.focus();
    fireEvent.submit(mode.closest('form')!);
    const heading = await screen.findByRole('heading', {
      name: /onde vai ser/i,
    });
    expect(document.activeElement).toBe(heading);
  });
});

describe('Nova Carreira pelo port', () => {
  it('envia CreateCareer com careerName e perfil e abre a Central com o treinador', async () => {
    const api = new InMemoryCareerApi();
    const create = vi.spyOn(api, 'createCareer');
    const select = vi.spyOn(api, 'selectClub');
    render(<CareerGame api={api} />);
    fireEvent.click(
      screen.getByRole('button', { name: /entrar no vestiário/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /nova carreira/i }),
    );
    await completeNewCareer({
      club: 'Fluminense',
      coach: 'Bia',
      nationalityQuery: 'argen',
      nationality: 'AR',
      avatar: 3,
      personality: 'Motivador',
      careerName: 'Tricolor de Bia',
    });
    await screen.findByRole('button', { name: /jogar partida/i });
    expect(create).toHaveBeenCalledWith({
      coach: 'Bia',
      careerName: 'Tricolor de Bia',
      coachProfile: {
        nationality: 'AR',
        avatar: 'avatar-03',
        personality: 'motivador',
      },
    });
    expect(select).toHaveBeenCalledWith('Fluminense');
    const card = screen.getByRole('region', { name: 'Fluminense' });
    expect(card.textContent).toMatch(/tricolor de bia/i);
    const coach = within(card).getByRole('group', { name: /treinador/i });
    expect(coach.textContent).toMatch(/bia/i);
    expect(coach.textContent).toMatch(/motivador/i);
    expect(coach.querySelector('[data-avatar="avatar-03"]')).not.toBeNull();
    const list = await api.listCareers();
    expect(list.careers[0]).toEqual(
      expect.objectContaining({
        name: 'Tricolor de Bia',
        coachProfile: {
          nationality: 'AR',
          avatar: 'avatar-03',
          personality: 'motivador',
        },
      }),
    );
  });

  it('não cria outra carreira ao tentar de novo quando só a escolha do clube falhou', async () => {
    const api = new InMemoryCareerApi();
    const create = vi.spyOn(api, 'createCareer');
    const original = api.selectClub.bind(api);
    let fail = true;
    vi.spyOn(api, 'selectClub').mockImplementation(async (club) => {
      if (fail) {
        fail = false;
        throw new Error('Falha de rede. Tente novamente.');
      }
      return original(club);
    });
    render(<CareerGame api={api} />);
    fireEvent.click(
      screen.getByRole('button', { name: /entrar no vestiário/i }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /nova carreira/i }),
    );
    await completeNewCareer();
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /falha de rede/i,
    );
    fireEvent.click(screen.getByRole('button', { name: /começar carreira/i }));
    await screen.findByRole('button', { name: /jogar partida/i });
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });
});
