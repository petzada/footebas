import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacidadePage from '@/app/privacidade/page';
import TermosPage from '@/app/termos/page';
import { LEGAL_INFO } from '@/components/legal-page';

describe('Páginas legais', () => {
  it('Termos de uso identifica a empresa, o operador e o contato reais', () => {
    render(<TermosPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /termos de uso/i }),
    ).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(
      screen.getByRole('heading', { name: /licença única/i }),
    ).toBeTruthy();
    expect(screen.getByText(/7 dias corridos/i)).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /ranking público/i }),
    ).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/preencher/i);
    expect(text).toContain('Marct Soluções Digitais');
    expect(text).toContain('63.940.273/0001-36');
    expect(text).toContain('Marcio Petigrosso');
    expect(
      screen
        .getAllByRole('link', { name: LEGAL_INFO.email })
        .every(
          (link) => link.getAttribute('href') === `mailto:${LEGAL_INFO.email}`,
        ),
    ).toBe(true);
    expect(
      screen.getByRole('link', { name: /política de privacidade/i }),
    ).toBeTruthy();
  });

  it('Política de privacidade cobre LGPD, cookies e não venda de dados', () => {
    render(<PrivacidadePage />);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /política de privacidade/i,
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    for (const heading of [
      /quem é responsável/i,
      /login com google/i,
      /dados que coletamos/i,
      /base legal/i,
      /por quanto tempo/i,
      /seus direitos/i,
      /cookies e armazenamento local/i,
    ])
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(
      screen.getByText(/não vendemos nem alugamos dados pessoais/i),
    ).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/preencher/i);
    expect(text).toMatch(/encarregado .*\(DPO\)/);
    expect(text).toMatch(/uso limitado/i);
    expect(text).toContain(LEGAL_INFO.cnpj);
    expect(
      screen.getAllByRole('link', { name: LEGAL_INFO.email }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /termos de uso/i })).toBeTruthy();
  });
});
