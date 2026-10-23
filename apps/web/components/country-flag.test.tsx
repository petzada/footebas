import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CountryFlag } from '@/components/country-flag';
import { flagFor } from '@/lib/country-flags';

describe('CountryFlag', () => {
  it('usa o PNG pixel 3:2 quando o país está na folha', () => {
    expect(flagFor('BR')).toBe('/flags/br.png');
    render(<CountryFlag code="BR" width={24} />);
    const img = screen.getByRole('img', { name: /bandeira: brasil/i });
    expect(img.tagName).toBe('IMG');
    expect(img.getAttribute('src')).toBe('/flags/br.png');
    expect(img.getAttribute('width')).toBe('24');
    expect(img.getAttribute('height')).toBe('16');
    expect((img as HTMLImageElement).style.imageRendering).toBe('pixelated');
    expect(img.getAttribute('data-flag')).toBe('pixel');
  });

  it('cai para o selo com o código ISO sem arquivo', () => {
    expect(flagFor('PT')).toBeUndefined();
    render(<CountryFlag code="PT" />);
    const stamp = screen.getByRole('img', { name: /bandeira: portugal/i });
    expect(stamp.getAttribute('data-flag')).toBe('code');
    expect(stamp.textContent).toBe('PT');
  });

  it('é decorativa quando o país já está nomeado ao lado', () => {
    render(<CountryFlag code="AR" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('country-flag').getAttribute('alt')).toBe('');
  });
});
