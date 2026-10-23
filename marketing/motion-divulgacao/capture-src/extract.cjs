// Extracts real rendered pieces of the game UI (SVG/HTML) for the film.
const L = require('./lib.cjs');
const fs = require('fs');
const OUT = `${__dirname}/../assets/img`;
(async () => {
  const browser = await L.launch();
  const { page } = await L.newPage(browser, { viewport: { width: 1440, height: 900 }, dpr: 1 });
  await L.signIn(page, 'extract@footebas.test');
  await L.createCareer(page);
  const nav = page.getByRole('navigation', { name: 'Navegação principal desktop' });
  await nav.waitFor();
  await nav.getByRole('button', { name: /^Mapa/i }).first().click();
  await page.waitForTimeout(1500);
  const svg = await page.evaluate(() => {
    const s = [...document.querySelectorAll('main svg')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    return s ? s.outerHTML : '';
  });
  fs.writeFileSync(OUT + '/mapa-do-clube.svg', svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
  console.log('map svg bytes', svg.length);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
