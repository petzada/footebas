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

/**
 * Nova Carreira em cinco etapas (modo → universo → clube → treinador → nome),
 * até a Central.
 */
export async function createCareer(
  page: Page,
  { coach, club }: { coach: string; club: string },
): Promise<void> {
  const next = () => page.getByRole('button', { name: /^continuar$/i }).click();
  await page.getByRole('button', { name: /nova carreira/i }).click();
  await expect(
    page.getByRole('heading', { name: /como você quer jogar/i }),
  ).toBeVisible();
  await next();
  await expect(
    page.getByRole('heading', { name: /onde vai ser a sua carreira/i }),
  ).toBeVisible();
  await next();
  await expect(
    page.getByRole('heading', { name: /escolha seu clube/i }),
  ).toBeVisible();
  await page
    .getByRole('radio', { name: new RegExp(club, 'i') })
    .first()
    .check();
  await next();
  await expect(
    page.getByRole('heading', { name: /quem é o treinador/i }),
  ).toBeVisible();
  await page.getByLabel(/nome do treinador/i).fill(coach);
  await page
    .getByRole('radio', { name: /^estrategista/i })
    .check({ force: true });
  await next();
  await expect(
    page.getByRole('heading', { name: /dê um nome à carreira/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /começar carreira/i }).click();
  await expect(playButton(page)).toBeVisible();
}

export function playButton(page: Page) {
  return page.getByRole('button', { name: /jogar partida/i }).first();
}

/** Rótulo "· Rodada N" do cabeçalho da Central. */
export function roundLabel(page: Page) {
  return page.getByText(/rodada \d+/i).first();
}
