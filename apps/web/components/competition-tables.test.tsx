import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CompetitionTables } from '@/components/competition-tables';
import { InMemoryCareerApi, type CareerView } from '@/lib/career-api';
import { createFakeCompetitionProductPort } from '@/lib/competition-product';

async function career(club = 'Flamengo'): Promise<CareerView> {
  const api = new InMemoryCareerApi();
  await api.login('ana@footebas.com');
  await api.createCareer({ coach: 'Ana' });
  await api.selectClub(club);
  return (await api.getCareer())!;
}

function pickTab(list: RegExp, name: RegExp) {
  const tabs = screen.getByRole('tablist', { name: list });
  fireEvent.click(within(tabs).getByRole('tab', { name }));
}

describe('Classificação por formato (D7)', () => {
  it('pontos corridos: faixas de zona, legenda e o clube do jogador destacado', async () => {
    // As over HTTP: the server tables list the club, the career's division
    // name is the estadual, so the fixture's Série A stands.
    render(
      <CompetitionTables
        port={createFakeCompetitionProductPort()}
        career={{ ...(await career()), division: 'Carioca' }}
      />,
    );
    const competitions = await screen.findByRole('tablist', {
      name: /competição/i,
    });
    expect(
      within(competitions)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual([
      'Série Ameu clube',
      'Copa do Brasilmeu clube',
      'Libertadoresmeu clube',
      'Paulistão',
    ]);
    expect(
      within(competitions)
        .getByRole('tab', { name: /série a/i })
        .getAttribute('aria-selected'),
    ).toBe('true');
    const table = screen.getByRole('table', {
      name: /série a · pontos corridos/i,
    });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(1 + 20);
    const mine = rows.find(
      (row) => row.getAttribute('aria-current') === 'true',
    );
    expect(mine?.textContent).toMatch(/flamengo/i);
    expect(
      rows[1]!.querySelector('[data-zone]')?.getAttribute('data-zone'),
    ).toBe('title');
    expect(
      rows[20]!.querySelector('[data-zone]')?.getAttribute('data-zone'),
    ).toBe('relegation');
    expect(rows[10]!.querySelector('[data-zone]')).toBeNull();
    const legend = screen.getByRole('list', { name: /zonas da tabela/i });
    expect(legend.textContent).toContain('Libertadores');
    expect(legend.textContent).toContain('Rebaixamento');
    // One stage only: no stage selector.
    expect(screen.queryByRole('tablist', { name: /fase/i })).toBeNull();
  });

  it('mata-mata: confrontos por fase com ida, volta, agregado e desempate; fase não sorteada "a definir"', async () => {
    render(
      <CompetitionTables
        port={createFakeCompetitionProductPort()}
        career={await career()}
      />,
    );
    await screen.findByRole('tablist', { name: /competição/i });
    pickTab(/competição/i, /copa do brasil/i);
    const stages = screen.getByRole('tablist', {
      name: /fase · copa do brasil/i,
    });
    expect(
      within(stages)
        .getByRole('tab', { name: /quartas de final/i })
        .getAttribute('aria-selected'),
    ).toBe('true');
    const quartas = screen.getByRole('list', {
      name: /confrontos · copa do brasil · quartas/i,
    });
    expect(within(quartas).getAllByRole('listitem')).toHaveLength(4);
    const mine = within(quartas).getByRole('listitem', {
      name: 'Flamengo × Palmeiras',
    });
    expect(
      within(mine)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Confronto', 'Ida', 'Volta', 'Agr.']);
    expect(mine.textContent).toMatch(/volta em 11\/06/i);

    fireEvent.click(within(stages).getByRole('tab', { name: /oitavas/i }));
    const oitavas = screen.getByRole('list', {
      name: /confrontos · copa do brasil · oitavas/i,
    });
    const penalties = within(oitavas).getByRole('listitem', {
      name: 'Grêmio × Bahia',
    });
    expect(penalties.textContent).toMatch(
      /classificado: bahia · no desempate/i,
    );
    const fla = within(oitavas).getByRole('listitem', {
      name: 'Flamengo × Ceará',
    });
    expect(fla.textContent).toMatch(/classificado: flamengo/i);
    expect(fla.textContent).not.toMatch(/desempate/i);

    fireEvent.click(within(stages).getByRole('tab', { name: /semifinal/i }));
    expect(screen.getByText(/semifinal: a definir/i)).toBeTruthy();
    expect(screen.queryByRole('list', { name: /confrontos/i })).toBeNull();
  });

  it('Libertadores: pré em mata-mata com quem entra direto, grupos com o do clube primeiro, oitavas a definir', async () => {
    render(
      <CompetitionTables
        port={createFakeCompetitionProductPort()}
        career={await career()}
      />,
    );
    await screen.findByRole('tablist', { name: /competição/i });
    pickTab(/competição/i, /libertadores/i);
    expect(
      screen.getAllByRole('table', { name: /fase de grupos · grupo/i }),
    ).toHaveLength(4);
    const sections = screen.getAllByRole('region', {
      name: /fase de grupos · grupo/i,
    });
    expect(sections[0]!.getAttribute('aria-label')).toMatch(/grupo b/i);
    expect(within(sections[0]!).getByText(/meu grupo/i)).toBeTruthy();
    expect(
      within(sections[0]!)
        .getAllByRole('row')
        .find((row) => row.getAttribute('aria-current') === 'true')
        ?.textContent,
    ).toMatch(/flamengo/i);

    const stages = screen.getByRole('tablist', {
      name: /fase · libertadores/i,
    });
    fireEvent.click(
      within(stages).getByRole('tab', { name: /pré-libertadores/i }),
    );
    expect(
      screen.getByText(/entram direto:/i).parentElement?.textContent,
    ).toMatch(/palmeiras, flamengo, atlético mineiro/i);
    expect(
      within(screen.getByRole('list', { name: /confrontos/i })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(2);

    fireEvent.click(within(stages).getByRole('tab', { name: /oitavas/i }));
    expect(screen.getByText(/oitavas de final: a definir/i)).toBeTruthy();
  });

  it('campeão decidido mostra a data; competição encerrada', async () => {
    render(
      <CompetitionTables
        port={createFakeCompetitionProductPort()}
        career={await career()}
      />,
    );
    await screen.findByRole('tablist', { name: /competição/i });
    pickTab(/competição/i, /paulistão/i);
    expect(
      screen.getByText(/campeão: palmeiras · decidido em 14\/02/i),
    ).toBeTruthy();
    expect(screen.getByText(/^encerrada$/i)).toBeTruthy();
  });

  it('abre direto na competição pedida e lembra a fase escolhida ao voltar', async () => {
    render(
      <CompetitionTables
        port={createFakeCompetitionProductPort()}
        career={await career()}
        initialCompetitionId="copa_do_brasil"
      />,
    );
    const competitions = await screen.findByRole('tablist', {
      name: /competição/i,
    });
    expect(
      within(competitions)
        .getByRole('tab', { name: /copa do brasil/i })
        .getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: /^final/i }));
    pickTab(/competição/i, /série a/i);
    pickTab(/competição/i, /copa do brasil/i);
    expect(
      screen
        .getByRole('tab', { name: /^final/i })
        .getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('sem a leitura de tabelas no servidor mostra a liga do read model da carreira', async () => {
    const port = createFakeCompetitionProductPort();
    delete port.tables;
    render(<CompetitionTables port={port} career={await career()} />);
    const table = await screen.findByRole('table', {
      name: /classificação completa · série a/i,
    });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(2);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('a liga do demo substitui a Série A da fixture quando o clube não está nas tabelas', async () => {
    render(
      <CompetitionTables
        port={createFakeCompetitionProductPort()}
        career={{
          ...(await career()),
          club: 'Clube Novo',
          standings: [
            { position: 1, club: 'Clube Novo', played: 1, points: 3 },
            { position: 2, club: 'Palmeiras', played: 1, points: 0 },
          ],
        }}
      />,
    );
    const table = await screen.findByRole('table', {
      name: /série a · pontos corridos/i,
    });
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 2);
    expect(
      within(table)
        .getAllByRole('row')
        .find((row) => row.getAttribute('aria-current') === 'true')
        ?.textContent,
    ).toMatch(/clube novo/i);
  });
});
