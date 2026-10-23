import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SquadScreen } from '@/components/squad-screen';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';
import type { LineupInput } from '@/lib/management-model';

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

  it('mostra o entrosamento e permite a escalação automática', async () => {
    const { api } = await setup();
    expect(screen.getByLabelText(/entrosamento 58 de 100/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^poupar$/i }));
    await waitFor(async () =>
      expect(
        (await api.getCareer())?.players.filter((p) => p.role === 'starter'),
      ).toHaveLength(11),
    );
  });
});
