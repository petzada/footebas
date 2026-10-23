// Size of the web's client JavaScript after `next build` (wave 0 of
// docs/10-latencia-e-escala.md): prints a Markdown table (raw and gzip) for the
// CI job summary. Usage: node tools/bundle-report.mjs apps/web/.next/static
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = process.argv[2] ?? 'apps/web/.next/static';
const TOP = 12;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (path.endsWith('.js') || path.endsWith('.css')) yield path;
  }
}

const kb = (bytes) => (bytes / 1024).toFixed(1);
const rows = [...files(root)].map((path) => {
  const content = readFileSync(path);
  return {
    path: relative(root, path).replaceAll('\\', '/'),
    raw: content.length,
    gzip: gzipSync(content, { level: 9 }).length,
  };
});
rows.sort((a, b) => b.gzip - a.gzip);
const total = (key, ext) =>
  rows
    .filter(({ path }) => path.endsWith(ext))
    .reduce((sum, row) => sum + row[key], 0);

console.log('## Bundle do web (cliente)\n');
console.log('| | Arquivos | Bruto (KB) | gzip (KB) |');
console.log('| --- | ---: | ---: | ---: |');
for (const ext of ['.js', '.css'])
  console.log(
    `| ${ext} | ${String(rows.filter(({ path }) => path.endsWith(ext)).length)} | ${kb(total('raw', ext))} | ${kb(total('gzip', ext))} |`,
  );
console.log(`\n### ${String(TOP)} maiores (gzip)\n`);
console.log('| Arquivo | Bruto (KB) | gzip (KB) |');
console.log('| --- | ---: | ---: |');
for (const row of rows.slice(0, TOP))
  console.log(`| \`${row.path}\` | ${kb(row.raw)} | ${kb(row.gzip)} |`);
