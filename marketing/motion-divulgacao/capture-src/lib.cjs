// Shared helpers to drive the real Footebas UI (local dev stack: API in memory
// + Next dev with NEXT_PUBLIC_AUTH_MODE=dev). @playwright/test resolves from
// tools/e2e; CHROME_PATH picks a browser binary.
const { chromium } = require(require.resolve('@playwright/test', { paths: [`${__dirname}/../../../tools/e2e`] }));
const BASE = process.env.FOOTEBAS_URL ?? 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH;
const HIDE = 'nextjs-portal{display:none!important}';

async function launch() {
  return chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, deviceScaleFactor: opts.dpr ?? 1, locale: 'pt-BR', ...(opts.ctx ?? {}) });
  await ctx.addInitScript((css) => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.id = '__hide'; s.textContent = css; document.head.appendChild(s); }); }, HIDE);
  if (opts.clock) await ctx.clock.install();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  return { ctx, page };
}

async function signIn(page, email) {
  await page.goto(BASE + '/');
  await page.getByLabel('Seu e-mail').fill(email);
  await page.getByRole('button', { name: /entrar no vestiário/i }).click();
  await page.getByRole('button', { name: /nova carreira/i }).waitFor({ timeout: 60000 });
}

async function createCareer(page, { club = 'Flamengo', coach = 'Ana', style = 'Motivador' } = {}) {
  const next = () => page.getByRole('button', { name: /^continuar$/i }).click({ force: true });
  await page.getByRole('button', { name: /nova carreira/i }).click();
  await page.getByRole('heading', { name: /como você quer jogar/i }).waitFor();
  await next();
  await page.getByRole('heading', { name: /onde vai ser a sua carreira/i }).waitFor();
  await next();
  await page.getByRole('heading', { name: /escolha seu clube/i }).waitFor();
  const radio = page.getByRole('radio', { name: new RegExp(club, 'i') }).first();
  await page.locator('label').filter({ has: radio }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /escolher este clube/i }).click({ force: true });
  await page.getByRole('heading', { name: /quem é o treinador/i }).waitFor();
  await page.getByLabel(/nome do treinador/i).fill(coach);
  await next();
  await page.getByRole('heading', { name: /qual é o estilo do treinador/i }).waitFor();
  const est = page.getByRole('radio', { name: new RegExp('^' + style, 'i') }).first();
  await page.locator('label').filter({ has: est }).first().click();
  await next();
  await page.getByRole('heading', { name: /dê um nome à carreira/i }).waitFor();
  await page.getByRole('button', { name: /começar carreira/i }).click();
  await page.getByRole('button', { name: /jogar partida/i }).first().waitFor({ timeout: 60000 });
}

/** Squad rows read from the Elenco list: name, age, position, role, rating. */
async function readSquad(page) {
  const nav = page.getByRole('navigation', { name: 'Navegação principal desktop' });
  await nav.getByRole('button', { name: /^Elenco/i }).first().click();
  await page.waitForTimeout(1200);
  const text = await page.locator('main').innerText();
  const rows = [];
  const re = /\n([^\n]+)\n(\d{2}) anos · ([A-Z]{2,3})(?: \/ ([A-Z]{2,3}))?\n(TITULAR|BANCO|RESERVA)\n(\d{2})/g;
  let m;
  while ((m = re.exec(text))) rows.push({ name: m[1].trim(), age: +m[2], pos: m[3], pos2: m[4] ?? '', role: m[5], ovr: +m[6] });
  await nav.getByRole('button', { name: /^Central/i }).first().click();
  await page.waitForTimeout(800);
  return rows;
}

async function liveState(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)?.textContent?.trim() ?? '';
    const live = document.querySelector('[data-testid="live-match"]');
    const badge = live?.querySelector('section [class*="font-pixel"], section span')?.textContent ?? '';
    return {
      status: live ? (live.querySelector('section')?.innerText.split('\n')[0] ?? '') : '',
      score: q('[data-testid="live-scoreboard"]'),
      narration: q('[data-testid="live-narration"]'),
      done: /fim de jogo/i.test(document.body.innerText),
    };
  });
}

module.exports = { launch, newPage, signIn, createCareer, readSquad, liveState, BASE };
