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
import { createFakeAccountPort } from '@/lib/account-product';
import { InMemoryCareerApi } from '@/lib/career-api';

const next = () =>
  fireEvent.click(screen.getByRole('button', { name: /^continuar$/i }));

function renderWizard(
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
  extra: Partial<React.ComponentProps<typeof NewCareerWizard>> = {},
) {
  render(
    <NewCareerWizard onSubmit={onSubmit} onCancel={onCancel} {...extra} />,
  );
  return { onSubmit, onCancel };
}

const dialog = () => screen.getByRole('dialog');

/** Opens the squad sheet of `name` and confirms it. */
const chooseClub = async (name: RegExp) => {
  fireEvent.click(screen.getByRole('radio', { name }));
  fireEvent.click(
    within(dialog()).getByRole('button', { name: /escolher este clube/i }),
  );
};

describe('Nova Carreira em seis etapas', () => {
  it('percorre modo → universo → clube → treinador → estilo → nome e envia o perfil', async () => {
    const { onSubmit } = renderWizard();
    const progress = () =>
      screen.getByRole('progressbar', { name: /etapa \d de 6/i });

    expect(screen.getByText(/nova carreira · 1 de 6/i)).toBeTruthy();
    expect(progress().getAttribute('aria-label')).toMatch(
      /etapa 1 de 6: modo/i,
    );
    expect(
      screen.getByRole('radio', { name: /modo treinador/i }),
    ).toHaveProperty('checked', true);
    // Fixed footer: Voltar above, Continuar below, both at least 44px tall.
    const footer = screen.getByTestId('wizard-footer');
    const buttons = within(footer).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringMatching(/voltar ao início/i),
      expect.stringMatching(/continuar/i),
    ]);
    expect(footer.className).toMatch(/fixed/);
    expect(buttons[0]!.className).toMatch(/min-h-11/);
    expect(buttons[1]!.className).toMatch(/min-h-12/);
    next();

    expect(await screen.findByRole('heading', { name: /onde vai ser/i })).toBe(
      document.activeElement,
    );
    expect(progress().getAttribute('aria-label')).toMatch(/2 de 6: universo/i);
    next();

    await screen.findByRole('heading', { name: /escolha seu clube/i });
    // No fixed bar on the club step; a discreet back arrow instead.
    expect(screen.queryByTestId('wizard-footer')).toBeNull();
    expect(screen.getByRole('button', { name: /^voltar$/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /fluminense/i }));
    const sheet = dialog();
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.textContent).toMatch(/elenco do fluminense/i);
    for (const group of [
      'Goleiros',
      'Defensores',
      'Meio-campistas',
      'Atacantes',
    ])
      expect(within(sheet).getByText(group)).toBeTruthy();
    expect(
      within(sheet).getAllByText(/craque|destaque/i).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      within(sheet).getByRole('button', { name: /escolher este clube/i }),
    );

    await screen.findByRole('heading', { name: /quem é o treinador/i });
    expect(progress().getAttribute('aria-label')).toMatch(/4 de 6/i);
    fireEvent.change(screen.getByLabelText(/nome do treinador/i), {
      target: { value: '  Marcio  ' },
    });
    // Brasil preselected; the country list is collapsed until opened.
    expect(
      screen.getByText(/selecionada:/i).parentElement?.textContent,
    ).toMatch(/brasil/i);
    expect(screen.queryByRole('listbox', { name: /^país$/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /trocar país/i }));
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
    expect(screen.queryByRole('listbox', { name: /^país$/i })).toBeNull();
    expect(
      screen.getByText(/selecionada:/i).parentElement?.textContent,
    ).toMatch(/portugal/i);
    fireEvent.click(screen.getByRole('radio', { name: 'Avatar 7' }));
    next();

    await screen.findByRole('heading', {
      name: /qual é o estilo do treinador/i,
    });
    expect(progress().getAttribute('aria-label')).toMatch(/5 de 6: estilo/i);
    fireEvent.click(screen.getByRole('radio', { name: /^diplomata/i }));
    next();

    await screen.findByRole('heading', { name: /dê um nome à carreira/i });
    const name = screen.getByLabelText(/nome da carreira/i);
    expect((name as HTMLInputElement).value).toBe('Carreira de Marcio');
    fireEvent.change(name, { target: { value: 'Rumo ao topo' } });
    const summary = screen.getByRole('region', { name: /resumo/i });
    expect(summary.textContent).toMatch(/marcio/i);
    expect(summary.textContent).toMatch(/portugal/i);
    expect(summary.textContent).not.toMatch(/🇵🇹|\bPT\b/);
    expect(summary.textContent).toMatch(/diplomata/i);
    expect(summary.textContent).toMatch(/fluminense/i);
    expect(summary.querySelector('[data-testid="club-emblem"]')).toBeNull();
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

  it('valida treinador, estilo e nome da carreira em português', async () => {
    const { onSubmit } = renderWizard();
    next();
    next();
    await screen.findByRole('heading', { name: /escolha seu clube/i });
    await chooseClub(/flamengo/i);

    await screen.findByRole('heading', { name: /quem é o treinador/i });
    next();
    const coach = screen.getByLabelText(/nome do treinador/i);
    expect(coach.getAttribute('aria-invalid')).toBe('true');
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /informe o nome do treinador/i,
    );
    fireEvent.change(coach, { target: { value: 'Ana' } });
    next();

    await screen.findByRole('heading', { name: /qual é o estilo/i });
    next();
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /escolha a personalidade/i,
    );
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
    await chooseClub(/atlético mineiro/i);
    await screen.findByRole('heading', { name: /quem é o treinador/i });
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    await screen.findByRole('heading', { name: /escolha seu clube/i });
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

  it('a folha do clube fecha com Esc, "Voltar" e devolve o foco ao cartão', async () => {
    renderWizard();
    next();
    next();
    await screen.findByRole('heading', { name: /escolha seu clube/i });
    const card = screen.getByRole('radio', { name: /fluminense/i });
    fireEvent.click(card);
    expect(document.activeElement).toBe(
      within(dialog()).getByRole('button', { name: /fechar/i }),
    );
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(card);
    fireEvent.click(card);
    fireEvent.click(
      within(dialog()).getByRole('button', { name: /^voltar$/i }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    // Nothing was chosen: the step stays.
    expect(screen.getByRole('heading', { name: /escolha seu clube/i }));
  });

  it('usa classes anti-estouro nas etapas de clube e treinador', async () => {
    renderWizard();
    next();
    next();
    await screen.findByRole('heading', { name: /escolha seu clube/i });
    const grid = screen.getByTestId('club-grid');
    expect(grid.className).toMatch(/minmax\(/);
    const card = screen
      .getByRole('radio', { name: /flamengo/i })
      .closest('label')!;
    expect(card.className).toMatch(/min-w-0/);
    expect(card.className).toMatch(/overflow-hidden/);
    expect(card.querySelector('strong')?.className).toMatch(/break-words/);
    const emblem = card.querySelector<HTMLElement>(
      '[data-testid="club-emblem"]',
    )!;
    expect(emblem.style.width).toBe('56px');
    await chooseClub(/flamengo/i);
    await screen.findByRole('heading', { name: /quem é o treinador/i });
    const avatars = screen
      .getByRole('radio', { name: 'Avatar 1' })
      .closest('div')!;
    expect(avatars.className).toMatch(/minmax\(0,1fr\)/);
  });
});

describe('Nova Carreira: plano grátis e licença', () => {
  const lockedSetup = async (
    extra: Partial<React.ComponentProps<typeof NewCareerWizard>> = {},
  ) => {
    const onSubmit = vi.fn();
    renderWizard(onSubmit, vi.fn(), {
      anyClub: false,
      pollMs: 10,
      account: createFakeAccountPort({ priceCents: 4990, paidAfterPolls: 1 }),
      ...extra,
    });
    next();
    next();
    await screen.findByRole('heading', { name: /escolha seu clube/i });
    return onSubmit;
  };

  it('abre na Série C, e um clube bloqueado abre a folha com o upsell', async () => {
    await lockedSetup();
    expect(
      screen
        .getByRole('button', { name: /série c/i })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /série a/i }));
    const flamengo = screen.getByRole('radio', { name: /flamengo/i });
    expect(flamengo.closest('label')?.textContent).toMatch(/licença/i);
    fireEvent.click(flamengo);
    const sheet = dialog();
    expect(sheet.textContent).toMatch(/elenco do flamengo/i);
    expect(within(sheet).getByText('Goleiros')).toBeTruthy();
    expect(
      within(sheet).queryByRole('button', { name: /escolher este clube/i }),
    ).toBeNull();
    expect(
      within(sheet).getByRole('button', { name: /assinar licença/i }),
    ).toBeTruthy();
    expect(flamengo).toHaveProperty('checked', false);
  });

  it('"Escolher um clube da Série C" fecha a folha e volta para a Série C', async () => {
    await lockedSetup();
    fireEvent.click(screen.getByRole('button', { name: /série b/i }));
    const first = screen.getAllByRole('radio')[0]!;
    fireEvent.click(first);
    fireEvent.click(
      within(dialog()).getByRole('button', {
        name: /escolher um clube da série c/i,
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: /série c/i })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('gera o PIX na folha, faz polling até pago, seleciona o clube e segue', async () => {
    const onLicensed = vi.fn();
    const onSubmit = await lockedSetup({ onLicensed });
    fireEvent.click(screen.getByRole('button', { name: /série a/i }));
    fireEvent.click(screen.getByRole('radio', { name: /flamengo/i }));
    fireEvent.click(
      within(dialog()).getByRole('button', { name: /assinar licença/i }),
    );
    const sheet = dialog();
    expect(sheet.textContent).toMatch(/5 carreiras/i);
    expect(sheet.textContent).toMatch(/qualquer clube/i);
    expect(sheet.textContent).toMatch(/nunca esportiva/i);
    fireEvent.click(within(sheet).getByRole('button', { name: /gerar pix/i }));
    expect(await within(sheet).findByText('R$ 49,90')).toBeTruthy();
    const code = within(sheet).getByLabelText(/pix copia e cola/i);
    expect((code as HTMLTextAreaElement).value).toMatch(/br\.gov\.bcb\.pix/);
    expect(within(sheet).getByRole('button', { name: /copiar código pix/i }));
    expect(within(sheet).getByText(/aguardando pagamento/i)).toBeTruthy();
    await within(sheet).findByText(/pagamento confirmado/i);
    expect(onLicensed).toHaveBeenCalled();
    fireEvent.click(
      within(sheet).getByRole('button', { name: /continuar com o flamengo/i }),
    );
    await screen.findByRole('heading', { name: /quem é o treinador/i });
    fireEvent.click(screen.getByRole('button', { name: /^voltar$/i }));
    await screen.findByRole('heading', { name: /escolha seu clube/i });
    expect(screen.getByRole('radio', { name: /flamengo/i })).toHaveProperty(
      'checked',
      true,
    );
    // Licensed now: any club opens with "Escolher este clube".
    fireEvent.click(screen.getByRole('radio', { name: /palmeiras/i }));
    expect(
      within(dialog()).getByRole('button', { name: /escolher este clube/i }),
    ).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('mostra erro claro quando o provedor PIX está fora', async () => {
    await lockedSetup({
      account: createFakeAccountPort({ providerDown: true }),
    });
    fireEvent.click(screen.getByRole('button', { name: /série a/i }));
    fireEvent.click(screen.getByRole('radio', { name: /flamengo/i }));
    fireEvent.click(
      within(dialog()).getByRole('button', { name: /assinar licença/i }),
    );
    fireEvent.click(
      within(dialog()).getByRole('button', { name: /gerar pix/i }),
    );
    expect((await within(dialog()).findByRole('alert')).textContent).toMatch(
      /indisponível agora.*nada foi cobrado/i,
    );
    expect(
      within(dialog()).getByRole('button', { name: /tentar de novo/i }),
    ).toBeTruthy();
  });
});

describe('Nova Carreira: avatar', () => {
  const toCoach = async (
    extra: Partial<React.ComponentProps<typeof NewCareerWizard>> = {},
  ) => {
    const onSubmit = vi.fn();
    renderWizard(onSubmit, vi.fn(), extra);
    next();
    next();
    await screen.findByRole('heading', { name: /escolha seu clube/i });
    await chooseClub(/flamengo/i);
    await screen.findByRole('heading', { name: /quem é o treinador/i });
    return onSubmit;
  };

  it('envia a própria imagem pelo port, mostra a prévia e remove', async () => {
    const uploadAvatar = vi.fn().mockResolvedValue({
      url: 'https://cdn.footebas.com.br/avatars/u/1.png',
    });
    const account = { ...createFakeAccountPort(), uploadAvatar };
    const onSubmit = await toCoach({ account });
    expect(screen.getByRole('radio', { name: 'Avatar 1' })).toHaveProperty(
      'checked',
      true,
    );
    const input = screen.getByLabelText(/usar minha imagem/i);
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    });
    fireEvent.change(input, { target: { files: [big] } });
    expect((await screen.findByRole('status')).textContent).toMatch(
      /até 2 MB/i,
    );
    expect(uploadAvatar).not.toHaveBeenCalled();
    fireEvent.change(input, {
      target: { files: [new File(['gif'], 'a.gif', { type: 'image/gif' })] },
    });
    expect(screen.getByRole('status').textContent).toMatch(
      /png, jpeg ou webp/i,
    );
    const file = new File(['png'], 'eu.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledWith(file));
    const preview = await screen.findByRole('img', {
      name: /prévia da sua imagem/i,
    });
    expect(preview.getAttribute('src')).toBe(
      'https://cdn.footebas.com.br/avatars/u/1.png',
    );
    expect(screen.getByRole('radio', { name: 'Avatar 1' })).toHaveProperty(
      'checked',
      false,
    );
    fireEvent.change(screen.getByLabelText(/nome do treinador/i), {
      target: { value: 'Ana' },
    });
    next();
    await screen.findByRole('heading', { name: /qual é o estilo/i });
    fireEvent.click(screen.getByRole('radio', { name: /^motivador/i }));
    next();
    await screen.findByRole('heading', { name: /dê um nome/i });
    fireEvent.click(screen.getByRole('button', { name: /começar carreira/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        coachProfile: expect.objectContaining({
          avatar: 'https://cdn.footebas.com.br/avatars/u/1.png',
        }),
      }),
    );
  });

  it('foto do Google vem pré-selecionada e pode ser trocada por pixel art', async () => {
    await toCoach({ avatarUrl: 'https://lh3.googleusercontent.com/a/foto' });
    expect(
      screen
        .getByRole('img', { name: /prévia da sua imagem/i })
        .getAttribute('src'),
    ).toBe('https://lh3.googleusercontent.com/a/foto');
    for (const radio of screen.getAllByRole('radio', { name: /^avatar \d+/i }))
      expect(radio).toHaveProperty('checked', false);
    fireEvent.click(screen.getByRole('button', { name: /remover imagem/i }));
    expect(screen.getByRole('radio', { name: 'Avatar 1' })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.queryByRole('img', { name: /prévia/i })).toBeNull();
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
