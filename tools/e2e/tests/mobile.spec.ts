import { expect, test } from '@playwright/test';
import { createCareer, playButton, signIn, uniqueEmail } from './helpers.js';

test.use({
  viewport: { width: 375, height: 812 },
  hasTouch: true,
  isMobile: true,
});

test('celular 375×812: chega à Central sem rolagem horizontal', async ({
  page,
}) => {
  await signIn(page, uniqueEmail('celular'));
  await createCareer(page, { coach: 'Treinadora Celular', club: 'Fluminense' });

  await expect(playButton(page)).toBeInViewport();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
