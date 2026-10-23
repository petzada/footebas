import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SquadScreen } from '@/components/squad-screen';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';
import {
  autoPickSummary,
  FORMATION_LAYOUT,
  SERVER_FORMATIONS,
  type LineupInput,
} from '@/lib/management-model';

beforeAll(() => {
  // jsdom has no PointerEvent: MouseEvent carries the same coordinates.
  if (typeof window.PointerEvent === 'undefined')
    vi.stubGlobal('PointerEvent', MouseEvent);
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

async function setup() {
  const api = new InMemoryCareerApi();
  await api.login('a@b.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub('Flamengo');
  const career = (await api.getCareer())!;
  const sent: LineupInput[] = [];
  const original = api.setLineup.bind(api);
  vi.spyOn(api, 'setLineup').mockImplementation(async (input) => {
    sent.push(input);
    return original(input);
  });
  const onCareerChange = vi.fn<(value: CareerView) => void>();
  const reportError = vi.fn<(message: string) => void>();
  render(
    <SquadScreen
      career={career}
      api={api}
      onCareerChange={onCareerChange}
      reportError={reportError}
    />,
  );
  return { api, career, sent, onCareerChange, reportError };
}

async function selectTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name });
  await act(async () => {
    tab.focus();
    fireEvent.keyDown(tab, { key: 'Enter' });
    await Promise.resolve();
  });
}

const slot = (position: RegExp) =>
  screen
    .getAllByRole('button', { name: position })
    .find((element) => element.hasAttribute('data-slot-position'))!;

const card = () => screen.getByTestId('card-selecionado');

/** Drags a chip with pointer events onto the element `over`. */
function drag(chip: HTMLElement, over: HTMLElement) {
  // jsdom has no hit testing: the drop target is whatever is under the pointer.
  document.elementFromPoint = () => over;
  fireEvent.pointerDown(chip, { clientX: 10, clientY: 10, button: 0 });
  fireEvent.pointerMove(chip, { clientX: 60, clientY: 80 });
  fireEvent.pointerUp(chip, { clientX: 60, clientY: 80 });
}

describe('Elenco · campo tático', () => {
  it('arrastar e a alternativa por toque produzem a mesma escalação e o mesmo SetLineup', async () => {
    const first = await setup();
    const royal = slot(/lateral direito: emerson royal/i);
    const benchZone = screen.getByRole('list', {
      name: /^banco$/i,
    }).parentElement!;
    drag(royal, benchZone);
    expect(
      screen.getByRole('button', { name: /emerson royal.*no banco/i }),
    ).toBeTruthy();
    expect(screen.getByText(/faltam 1 titular/i)).toBeTruthy();
    const varela = screen.getByRole('button', { name: /danilo.*no banco/i });
    drag(varela, slot(/lateral direito: vaga livre/i));
    expect(slot(/lateral direito: danilo/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /salvar escalação/i }));
    await waitFor(() => expect(first.sent).toHaveLength(1));

    document.body.innerHTML = '';
    const second = await setup();
    fireEvent.click(slot(/lateral direito: emerson royal/i));
    expect(screen.getByRole('status').textContent).toMatch(
      /emerson royal selecionado/i,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: /mandar emerson royal para o banco/i,
      }),
    );
    expect(screen.getByRole('status').textContent).toMatch(/agora no banco/i);
    fireEvent.click(screen.getByRole('button', { name: /danilo.*no banco/i }));
    fireEvent.click(slot(/lateral direito: vaga livre/i));
    fireEvent.click(screen.getByRole('button', { name: /salvar escalação/i }));
    await waitFor(() => expect(second.sent).toHaveLength(1));

    const [byDrag] = first.sent;
    const [byTap] = second.sent;
    expect(byTap).toEqual(byDrag);
    expect(byDrag!.starters).toHaveLength(11);
    expect(byDrag!.starters[1]).toEqual({
      playerId: expect.stringMatching(/fla-/),
      position: 'LD',
    });
    expect(byDrag!.bench).toContain('fla-22');
    expect(byDrag!.starters.map((s) => s.playerId)).not.toContain('fla-22');
    expect(second.onCareerChange).toHaveBeenCalled();
    const saved = second.onCareerChange.mock.calls.at(-1)![0];
    expect(saved.players.find((player) => player.id === 'fla-22')?.role).toBe(
      'bench',
    );
  });

  it('o teclado (Enter no jogador e no destino) produz o mesmo movimento', async () => {
    const { sent } = await setup();
    const royal = slot(/lateral direito: emerson royal/i);
    royal.focus();
    fireEvent.keyDown(royal, { key: 'Enter' });
    fireEvent.click(royal); // Enter activates a native button.
    expect(screen.getByRole('status').textContent).toMatch(/selecionado/i);
    const benchButton = screen.getByRole('button', {
      name: /mandar emerson royal para o banco/i,
    });
    benchButton.focus();
    fireEvent.keyDown(benchButton, { key: 'Enter' });
    fireEvent.click(benchButton);
    expect(
      screen.getByRole('button', { name: /emerson royal.*no banco/i }),
    ).toBeTruthy();
    const danilo = screen.getByRole('button', { name: /danilo.*no banco/i });
    danilo.focus();
    fireEvent.keyDown(danilo, { key: 'Enter' });
    fireEvent.click(danilo);
    const free = slot(/lateral direito: vaga livre/i);
    free.focus();
    fireEvent.keyDown(free, { key: 'Enter' });
    fireEvent.click(free);
    expect(slot(/lateral direito: danilo/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /salvar escalação/i }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.bench).toContain('fla-22');
    expect(sent[0]!.starters[1]!.position).toBe('LD');
  });

  it('bloqueia o envio enquanto a escalação tem pendências', async () => {
    const { sent, reportError } = await setup();
    fireEvent.click(slot(/goleiro: agustín rossi/i));
    fireEvent.click(
      screen.getByRole('button', {
        name: /mandar agustín rossi para as reservas/i,
      }),
    );
    expect(screen.getByText(/faltam 1 titular/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /salvar escalação/i }));
    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.stringMatching(/faltam 1 titular/i),
      ),
    );
    expect(sent).toHaveLength(0);
  });

  it('o campo é um SVG 68×105 com proporção fixa, altura limitada e fichas dentro do campo', async () => {
    await setup();
    const pitch = screen.getByTestId('campo');
    expect(pitch.className).toContain('aspect-[68/105]');
    expect(pitch.className).toMatch(/max-w-\[calc\(60svh/);
    expect(pitch.className).toContain('overflow-hidden');
    expect(pitch.querySelector('svg')?.getAttribute('viewBox')).toBe(
      '0 0 68 105',
    );
    // Tokens are at most 17% of the pitch width: no two slots may be closer
    // than that on the same line, and none may spill over the edges.
    for (const formation of SERVER_FORMATIONS) {
      const layout = FORMATION_LAYOUT[formation];
      for (const slot of layout) {
        expect(slot.x).toBeGreaterThanOrEqual(9);
        expect(slot.x).toBeLessThanOrEqual(91);
        expect(slot.y).toBeGreaterThanOrEqual(8);
        expect(slot.y).toBeLessThanOrEqual(92);
      }
      layout.forEach((a, i) =>
        layout.slice(i + 1).forEach((b) => {
          const dx = Math.abs(a.x - b.x);
          const dy = Math.abs(a.y - b.y);
          expect(dx >= 17 || dy >= 14).toBe(true);
        }),
      );
    }
    expect(pitch.querySelectorAll('[data-slot-position]')).toHaveLength(11);
    expect(pitch.className).not.toContain('overflow-x-auto');
  });
});

describe('Elenco · card do selecionado e lista', () => {
  it('a lista agrupada por posição leva o atleta ao card do topo, com as ações', async () => {
    await setup();
    expect(card().getAttribute('aria-label')).toMatch(/agustín rossi/i);
    const list = screen.getByTestId('lista-elenco');
    expect(within(list).getByRole('list', { name: /goleiros/i })).toBeTruthy();
    expect(within(list).getByRole('list', { name: /ataque/i })).toBeTruthy();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    fireEvent.click(
      within(list).getByRole('button', { name: /wallace yan.*reserva/i }),
    );
    expect(card().getAttribute('aria-label')).toMatch(/wallace yan/i);
    expect(scroll).toHaveBeenCalled();
    const actions = within(card());
    expect(actions.getByRole('button', { name: /^titular$/i })).toBeTruthy();
    expect(actions.getByRole('button', { name: /^banco$/i })).toBeTruthy();
    expect(
      actions.getByRole('button', { name: /escolher vaga no campo/i }),
    ).toBeTruthy();
    expect(
      actions
        .getByRole('button', { name: /definir wallace yan como capitão/i })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(
      actions.getByRole('button', { name: /anunciar no mercado/i }),
    ).toBeTruthy();
    expect(actions.getByText(/ver estatísticas/i)).toBeTruthy();

    // Busca filtra a lista.
    fireEvent.change(screen.getByPlaceholderText(/buscar por nome/i), {
      target: { value: 'pedro' },
    });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('escala pelo card, define capitão e envia o capitão no SetLineup', async () => {
    const { sent } = await setup();
    const list = screen.getByTestId('lista-elenco');
    fireEvent.click(within(list).getByRole('button', { name: /danilo/i }));
    fireEvent.click(within(card()).getByRole('button', { name: /^titular$/i }));
    expect(slot(/zagueiro: danilo/i)).toBeTruthy();
    fireEvent.click(
      within(card()).getByRole('button', {
        name: /definir danilo como capitão/i,
      }),
    );
    expect(
      within(card()).getByRole('button', { name: /danilo já é o capitão/i }),
    ).toBeTruthy();
    expect(slot(/zagueiro: danilo.*capitão/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /salvar escalação/i }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.captainId).toBe('fla-13');
  });

  it('anuncia o atleta à venda com preço, como no Mercado, e permite retirar', async () => {
    const { api } = await setup();
    const spy = vi.spyOn(api, 'listForTransfer');
    fireEvent.click(
      within(card()).getByRole('button', { name: /anunciar no mercado/i }),
    );
    const form = screen.getByRole('form', { name: /anunciar agustín rossi/i });
    fireEvent.change(within(form).getByLabelText(/preço pedido/i), {
      target: { value: '12000000' },
    });
    fireEvent.click(
      within(form).getByRole('button', { name: /colocar à venda/i }),
    );
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        playerId: 'fla-1',
        mode: 'sale',
        askingPrice: 12_000_000,
      }),
    );
    await screen.findByText(/à venda · r\$ 12 mi/i);
    expect((await api.getMarket()).listings.map((l) => l.playerId)).toContain(
      'fla-1',
    );
    fireEvent.click(
      screen.getByRole('button', { name: /retirar anúncio de agustín rossi/i }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /anunciar no mercado/i }),
      ).toBeTruthy(),
    );
  });

  it('renova o contrato pelo port quando o atleta tem contrato', async () => {
    const { api, onCareerChange } = await setup();
    const spy = vi.spyOn(api, 'renewContract');
    const list = screen.getByTestId('lista-elenco');
    fireEvent.click(within(list).getByRole('button', { name: /jorginho/i }));
    expect(within(card()).getByText(/contrato · /i)).toBeTruthy();
    fireEvent.click(
      within(card()).getByRole('button', {
        name: /renovar contrato por 12 meses/i,
      }),
    );
    await waitFor(() => expect(spy).toHaveBeenCalledWith('fla-21', 12));
    await waitFor(() => expect(onCareerChange).toHaveBeenCalled());
    const view = onCareerChange.mock.calls.at(-1)![0];
    expect(
      view.world.contracts.find((c) => c.playerId === 'fla-21')?.status,
    ).toBe('renewed');
  });
});

describe('Elenco · escalação automática', () => {
  it('cada modo mostra sua descrição e o resumo do que mudou', async () => {
    const { api } = await setup();
    expect(screen.getByText(/os mais fortes por posição/i)).toBeTruthy();
    expect(screen.getByText(/descansa quem está cansado/i)).toBeTruthy();
    expect(screen.getByText(/dá minutos aos jovens/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^poupar/i }));
    const summary = await screen.findByTestId('resumo-automatica');
    expect(summary.textContent).toMatch(
      /poupar · \d+ trocas?: .+ entra no lugar de/i,
    );
    expect(
      (await api.getCareer())?.players.filter((p) => p.role === 'starter'),
    ).toHaveLength(11);
    // Running the same mode again changes nothing and says so.
    fireEvent.click(screen.getByRole('button', { name: /^poupar/i }));
    await waitFor(() =>
      expect(screen.getByTestId('resumo-automatica').textContent).toMatch(
        /já é a ideal para este modo/i,
      ),
    );
  });

  it('Desenvolver troca por jovens quando há jovens disponíveis', async () => {
    const { api } = await setup();
    const before = (await api.getCareer())!.players;
    const youngReserve = before.find(
      (p) => p.age <= 23 && p.role !== 'starter' && !p.injuryRounds,
    )!;
    expect(youngReserve.name).toBe('Wallace Yan');
    fireEvent.click(screen.getByRole('button', { name: /^desenvolver/i }));
    const summary = await screen.findByTestId('resumo-automatica');
    expect(summary.textContent).toMatch(/wallace yan entra no lugar de/i);
    const after = (await api.getCareer())!.players;
    expect(after.find((p) => p.id === youngReserve.id)?.role).toBe('starter');
    const starters = after.filter((p) => p.role === 'starter');
    expect(starters).toHaveLength(11);
    const avgAge = (list: typeof starters) =>
      list.reduce((sum, p) => sum + p.age, 0) / list.length;
    expect(avgAge(starters)).toBeLessThan(
      avgAge(before.filter((p) => p.role === 'starter')),
    );
    // The pitch follows the server: the youngster is on a slot now.
    expect(
      screen
        .getAllByRole('button', { name: /wallace yan/i })
        .some((element) => element.hasAttribute('data-slot-position')),
    ).toBe(true);
  });

  it('autoPickSummary descreve trocas em pares e o caso sem mudança', () => {
    expect(autoPickSummary([], [])).toMatch(/já é a ideal/);
    const mk = (name: string, primaryPosition: string) =>
      ({ name, primaryPosition }) as never;
    expect(
      autoPickSummary(
        [mk('A', 'ATA'), mk('G', 'GOL')],
        [mk('B', 'ATA'), mk('H', 'GOL')],
      ),
    ).toBe('2 trocas: G entra no lugar de H; A entra no lugar de B.');
  });
});

describe('Elenco · táticas e escalações salvas', () => {
  it('aplica um preset e salva a tática pelo port', async () => {
    const { api } = await setup();
    await selectTab(/táticas/i);
    fireEvent.click(
      await screen.findByRole('button', { name: /pressão alta/i }),
    );
    expect(
      screen.getByRole('radio', { name: '4-3-3' }).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /salvar tática/i }));
    await waitFor(async () => {
      const career = await api.getCareer();
      expect(career?.formation).toBe('4-3-3');
      expect(career?.tactics.press).toBe('high');
      expect(career?.tactics.mentality).toBe('attacking');
    });
  });

  it('guarda escalações nomeadas por carreira no aparelho e reaplica', async () => {
    const { career } = await setup();
    fireEvent.change(screen.getByLabelText(/nome da escalação/i), {
      target: { value: 'Clássico' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
    expect(screen.getByText('Clássico')).toBeTruthy();
    expect(
      JSON.parse(
        window.localStorage.getItem(`footebas:lineups:${career.careerId}`)!,
      ),
    ).toHaveLength(1);
    fireEvent.click(slot(/lateral direito: emerson royal/i));
    fireEvent.click(
      screen.getByRole('button', {
        name: /mandar emerson royal para o banco/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /aplicar escalação clássico/i }),
    );
    expect(slot(/lateral direito: emerson royal/i)).toBeTruthy();
  });

  it('mostra o entrosamento', async () => {
    await setup();
    expect(screen.getByLabelText(/entrosamento 58 de 100/i)).toBeTruthy();
  });
});
