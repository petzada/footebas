import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacidadePage from '@/app/privacidade/page';
import TermosPage from '@/app/termos/page';
import { LEGAL_DRAFT_NOTICE } from '@/components/legal-page';

describe('Páginas legais', () => {
  it('Termos de uso renderiza com marcação de rascunho e marcadores a preencher', () => {
    render(<TermosPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /termos de uso/i }),
    ).toBeTruthy();
    expect(screen.getByRole('note').textContent).toBe(LEGAL_DRAFT_NOTICE);
    expect(
      screen.getByRole('heading', { name: /licença única/i }),
    ).toBeTruthy();
    expect(screen.getByText(/7 dias corridos/i)).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: /ranking público/i }),
    ).toBeTruthy();
    expect(document.body.textContent).toMatch(/\[preencher: CNPJ\]/);
    expect(document.body.textContent).not.toMatch(
      /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/,
    );
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
    expect(screen.getByRole('note').textContent).toBe(LEGAL_DRAFT_NOTICE);
    for (const heading of [
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
    expect(document.body.textContent).toMatch(
      /\[preencher: encarregado de dados/i,
    );
    expect(screen.getByRole('link', { name: /termos de uso/i })).toBeTruthy();
  });
});
