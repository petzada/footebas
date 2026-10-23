import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompetitionScreens } from '@/components/competition-screens';
import { createFakeCompetitionProductPort } from '@/lib/competition-product';

describe('competition and calendar screens', () => {
  it('shows all three divisions and the Brazilian competition phases', async () => {
    render(<CompetitionScreens port={createFakeCompetitionProductPort()} />);
    expect(
      await screen.findByRole('heading', { name: 'Competições' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Série A' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Série B' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Série C' })).toBeTruthy();
    expect(screen.getByText('Pré-Libertadores')).toBeTruthy();
    expect(screen.getByText('Turno único · São Paulo')).toBeTruthy();
  });

  it('"Ver tabela" leva à Classificação da competição do card (D7)', async () => {
    const onOpenTable = vi.fn();
    render(
      <CompetitionScreens
        port={createFakeCompetitionProductPort()}
        onOpenTable={onOpenTable}
      />,
    );
    await screen.findByRole('heading', { name: 'Competições' });
    fireEvent.click(
      screen.getByRole('button', { name: /ver tabela: copa do brasil/i }),
    );
    expect(onOpenTable).toHaveBeenCalledWith('copa_brasil');
  });

  it('exposes calendar validation and next-season transitions through keyboard tabs', async () => {
    render(<CompetitionScreens port={createFakeCompetitionProductPort()} />);
    await screen.findByRole('heading', { name: 'Competições' });
    const calendarTab = screen.getByRole('tab', { name: 'Calendário' });
    fireEvent.mouseDown(calendarTab, { button: 0, ctrlKey: false });
    fireEvent.click(calendarTab);
    expect(await screen.findByText(/Validado · sem conflitos/)).toBeTruthy();
    expect(screen.getByText('Final continental')).toBeTruthy();
    const nextTab = screen.getByRole('tab', { name: '2027' });
    fireEvent.mouseDown(nextTab, { button: 0, ctrlKey: false });
    fireEvent.click(nextTab);
    expect(
      screen.getByRole('heading', { name: 'Temporada 2027' }),
    ).toBeTruthy();
    expect(screen.getByText('Sport')).toBeTruthy();
    expect(screen.getByText('Vitória')).toBeTruthy();
    expect(screen.getAllByText(/Campeão da Copa do Brasil/)).toHaveLength(2);
    expect(screen.getByText(/\+900 prestígio/i)).toBeTruthy();
  });
});
