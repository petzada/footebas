import { expect, type Page } from '@playwright/test';

/** E-mail único por teste: a sessão dev deriva o usuário do e-mail. */
export function uniqueEmail(prefix: string): string {
  const suffix = `${String(Date.now())}${String(Math.floor(Math.random() * 1e6))}`;
  return `${prefix}.${suffix}@e2e.footebas.test`;
}

/** Acesso local (NEXT_PUBLIC_AUTH_MODE=dev) até a tela inicial. */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Seu e-mail').fill(email);
  await page.getByRole('button', { name: /entrar no vestiário/i }).click();
  await expect(
    page.getByRole('button', { name: /nova carreira/i }),
  ).toBeVisible();
}

/** Nova carreira → nome do treinador → clube, até a Central. */
export async function createCareer(
  page: Page,
  { coach, club }: { coach: string; club: string },
): Promise<void> {
  await page.getByRole('button', { name: /nova carreira/i }).click();
  await page.getByLabel('Nome do treinador').fill(coach);
  await page.getByRole('button', { name: /conhecer os clubes/i }).click();
  await expect(page.getByText(/escolha seu desafio/i)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(club, 'i') }).click();
  await expect(playButton(page)).toBeVisible();
}

export function playButton(page: Page) {
  return page.getByRole('button', { name: /jogar partida/i }).first();
}

/** Rótulo "· Rodada N" do cabeçalho da Central. */
export function roundLabel(page: Page) {
  return page.getByText(/rodada \d+/i).first();
}
