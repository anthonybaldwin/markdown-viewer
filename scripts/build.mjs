// build.mjs — bundle the content-side entries (content scripts can't use ESM /
// npm imports, so everything they need is bundled into IIFE files) and vendor
// KaTeX's stylesheet + fonts so math renders fully offline.

import { build } from 'esbuild';
import { cp, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const r = (...p) => path.join(root, ...p);

const entries = [
  { in: 'src/content/main.js', out: 'dist/content.js' },
  { in: 'src/content/mermaid-entry.js', out: 'dist/mermaid.js' },
  { in: 'src/content/detector-entry.js', out: 'dist/detector.js' },
];

async function bundle() {
  await mkdir(r('dist'), { recursive: true });
  for (const e of entries) {
    await build({
      entryPoints: [r(e.in)],
      outfile: r(e.out),
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: ['chrome110'],
      minify: true,
      sourcemap: false,
      legalComments: 'none',
      logLevel: 'info',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
  }
}

async function vendorKatex() {
  const dist = r('node_modules/katex/dist');
  await rm(r('vendor/katex'), { recursive: true, force: true });
  await mkdir(r('vendor/katex/fonts'), { recursive: true });
  await cp(path.join(dist, 'katex.min.css'), r('vendor/katex/katex.min.css'));
  // copy only the woff2 fonts (every modern target supports them) to stay slim
  const fonts = await readdir(path.join(dist, 'fonts'));
  for (const f of fonts) {
    if (!f.endsWith('.woff2')) continue;
    await cp(path.join(dist, 'fonts', f), r('vendor/katex/fonts', f));
  }
}

async function main() {
  if (existsSync(r('dist'))) await rm(r('dist'), { recursive: true, force: true });
  await bundle();
  await vendorKatex();
  console.log('\n✓ build complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
