import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signIn, uniqueEmail } from './helpers.js';

async function criticalViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')),
    }));
}

test('acesso e tela inicial sem violações críticas de acessibilidade', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('Seu e-mail')).toBeVisible();
  expect(await criticalViolations(page)).toEqual([]);

  await signIn(page, uniqueEmail('a11y'));
  expect(await criticalViolations(page)).toEqual([]);
});
