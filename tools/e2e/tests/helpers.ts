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
 * Nova Carreira em seis etapas (modo → universo → clube → treinador → estilo
 * → nome), até a Central. O cartão do clube abre a folha do elenco e
 * "Escolher este clube" já avança.
 */
export async function createCareer(
  page: Page,
  { coach, club }: { coach: string; club: string },
): Promise<void> {
  // Touch emulation in CI never reports the wizard button as "stable";
  // it is static in real browsers, so skip only that actionability wait.
  const next = () =>
    page.getByRole('button', { name: /^continuar$/i }).click({ force: true });
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
  await chooseCard(page, new RegExp(club, 'i'), { check: false });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /escolher este clube/i })
    .click({ force: true });
  await expect(
    page.getByRole('heading', { name: /quem é o treinador/i }),
  ).toBeVisible();
  await page.getByLabel(/nome do treinador/i).fill(coach);
  await next();
  await expect(
    page.getByRole('heading', { name: /qual é o estilo do treinador/i }),
  ).toBeVisible();
  await chooseCard(page, /^estrategista/i);
  await next();
  await expect(
    page.getByRole('heading', { name: /dê um nome à carreira/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /começar carreira/i }).click();
  await expect(playButton(page)).toBeVisible();
}

/** Cartões de escolha escondem o radio (sr-only): clica no rótulo visível. */
async function chooseCard(
  page: Page,
  name: RegExp,
  { check = true }: { check?: boolean } = {},
): Promise<void> {
  const radio = page.getByRole('radio', { name }).first();
  await page.locator('label').filter({ has: radio }).first().click();
  if (check) await expect(radio).toBeChecked();
}

export function playButton(page: Page) {
  return page.getByRole('button', { name: /jogar partida/i }).first();
}

/** Rótulo "· Rodada N" do cabeçalho da Central. */
export function roundLabel(page: Page) {
  return page.getByText(/rodada \d+/i).first();
}
