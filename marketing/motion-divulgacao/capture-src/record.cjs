// Records a real live match at the stage's native art resolution (480x300,
// DPR 0.5 on a 960x600 viewport) with a paused, stepped browser clock.
// Goal/substitution banners are hidden and logged so the film rebuilds them.
// Usage: node record.cjs <dev e-mail> <out dir> [Flamengo goals] [stop minute] [kid at half time 1|0]
const L = require('./lib.cjs');
const fs = require('fs');
const [email, outDir, wantGoals = '2', stopMinute = '93', halftimeKid = '1'] = process.argv.slice(2);
const OUT = outDir;
fs.mkdirSync(OUT, { recursive: true });
const FPS = 30;
const REC_CSS = `
html.rec, html.rec body { overflow: hidden !important; }
html.rec [data-testid="three-stage"] { position: fixed !important; left: 0 !important; top: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483000 !important; margin: 0 !important; box-shadow: none !important; }
html.rec [data-testid="three-stage"] > div { width: 100% !important; height: 100% !important; aspect-ratio: auto !important; }
html.rec [data-testid="goal-banner"], html.rec [data-testid="substitution-board"] { visibility: hidden !important; }
`;
(async () => {
  const browser = await L.launch();
  const { page } = await L.newPage(browser, { viewport: { width: 1280, height: 800 }, dpr: 0.5, clock: true });
  await L.signIn(page, email);
  await L.createCareer(page);
  const squad = await L.readSquad(page);
  const bench = squad.filter((p) => p.role === 'BANCO' && ['ATA', 'PE', 'PD', 'MEI'].includes(p.pos)).sort((a, b) => a.age - b.age);
  const mids = squad.filter((p) => p.role === 'TITULAR' && ['VOL', 'MC'].includes(p.pos)).sort((a, b) => a.ovr - b.ovr);
  const kid = bench[0], out = mids[0];
  await page.setViewportSize({ width: 960, height: 600 });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: REC_CSS });
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
  await page.getByRole('button', { name: /jogar partida/i }).first().click();
  for (let i = 0; i < 400; i++) {
    if (await page.evaluate(() => !!document.querySelector('[data-testid="three-stage"] canvas'))) break;
    await page.clock.runFor(16);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.documentElement.classList.add('rec'));
  const log = [];
  let frame = 0, ht = false, lastKey = '', flaGoals = 0, stopAt = Infinity, lastScore = '0 × 0';
  for (let guard = 0; guard < 6000; guard++) {
    await page.clock.runFor(1000 / FPS);
    const s = await page.evaluate(() => {
      const q = (sel) => document.querySelector(sel)?.textContent?.trim() ?? '';
      const live = document.querySelector('[data-testid="live-match"]');
      return {
        status: live ? (live.querySelector('section')?.innerText.split('\n')[0] ?? '') : '',
        score: q('[data-testid="live-scoreboard"]'),
        narration: q('[data-testid="live-narration"]'),
        goal: !!document.querySelector('[data-testid="goal-banner"]'),
        goalColor: document.querySelector('[data-testid="goal-banner"] span')?.style.color ?? '',
        sub: q('[data-testid="substitution-board"]'),
        done: /fim de jogo/i.test(document.body.innerText),
      };
    });
    const key = `${s.status}|${s.score}|${s.narration.slice(0, 40)}|${s.goal}|${s.sub}`;
    if (key !== lastKey) { log.push({ frame, ...s }); lastKey = key; console.log(frame, s.status, s.score, s.goal ? `[GOAL ${s.goalColor}]` : '', s.sub ? `[SUB ${s.sub}]` : '', '::', s.narration.slice(0, 80)); }
    if (s.score && s.score !== lastScore) {
      const [h, a] = s.score.split('×').map((x) => +x.trim());
      const [ph, pa] = lastScore.split('×').map((x) => +x.trim());
      if (a > pa && /Flamengo/i.test(await page.evaluate(() => document.querySelector('[data-testid="live-teams"]')?.innerText.split('\n').slice(-1)[0] ?? ''))) flaGoals++;
      if (h > ph && /Flamengo/i.test(await page.evaluate(() => document.querySelector('[data-testid="live-teams"]')?.innerText.split('\n')[0] ?? ''))) flaGoals++;
      lastScore = s.score;
      if (flaGoals >= +wantGoals && stopAt === Infinity) stopAt = frame + 150;
    }
    if (/intervalo/i.test(s.status) && !ht) {
      ht = true;
      await page.evaluate(() => document.documentElement.classList.remove('rec'));
      await page.locator('#live-mentality').selectOption('attacking');
      await page.getByRole('button', { name: /aplicar ajuste/i }).click();
      await page.waitForTimeout(1200);
      if (halftimeKid === '1' && kid && out) {
        await page.locator('#outgoing').selectOption({ label: out.name });
        await page.locator('#incoming').selectOption({ label: kid.name });
        await page.getByRole('button', { name: /confirmar substituição/i }).click();
        await page.waitForTimeout(1200);
      }
      await page.getByRole('button', { name: /começar o segundo tempo/i }).click();
      await page.waitForTimeout(500);
      await page.evaluate(() => document.documentElement.classList.add('rec'));
      log.push({ frame, event: 'second-half' });
      console.log(frame, '--- second half (ofensiva' + (halftimeKid === '1' ? ' + kid ' + kid?.name : '') + ')');
      continue;
    }
    await page.screenshot({ path: `${OUT}/f${String(frame).padStart(5, '0')}.png` });
    frame++;
    const m = /(\d+)'/.exec(s.status);
    if ((m && +m[1] >= +stopMinute) || s.done || frame >= stopAt || !s.status) break;
  }
  fs.writeFileSync(`${OUT}.json`, JSON.stringify(log, null, 1));
  console.log('frames', frame, 'flaGoals', flaGoals);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
