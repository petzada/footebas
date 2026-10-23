import { expect, test } from '@playwright/test';
import {
  createCareer,
  playButton,
  roundLabel,
  signIn,
  uniqueEmail,
} from './helpers.js';

test('login dev, cria carreira, joga uma rodada e recupera após recarregar', async ({
  page,
}) => {
  const email = uniqueEmail('carreira');
  const coach = 'Treinador E2E';

  await signIn(page, email);
  await createCareer(page, { coach, club: 'Flamengo' });
  const roundBefore = (await roundLabel(page).textContent()) ?? '';
  expect(roundBefore).toMatch(/rodada \d+/i);

  await playButton(page).click();
  await page
    .getByRole('button', { name: /pular (para o )?resultado/i })
    .click();
  await expect(page.getByText(/fim de jogo/i)).toBeVisible();
  await page
    .getByRole('button', { name: /preparar próxima rodada/i })
    .first()
    .click();
  await expect(playButton(page)).toBeVisible();

  await page.reload();
  await signIn(page, email);
  await page.getByRole('button', { name: /carregar carreira/i }).click();
  const careers = page.getByRole('list', { name: /suas carreiras/i });
  const row = careers.getByRole('listitem').filter({ hasText: coach });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Flamengo');
  await row.getByRole('button', { name: /^abrir /i }).click();

  await expect(playButton(page)).toBeVisible();
  await expect(roundLabel(page)).not.toHaveText(roundBefore);
});
