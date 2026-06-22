// build.mjs — bundle the content-side entries (content scripts can't use ESM /
// npm imports, so everything they need is bundled into IIFE files) and vendor
// KaTeX's stylesheet + fonts so math renders fully offline.

import { build } from 'esbuild';
import { cp, mkdir, rm, readdir, readFile, writeFile } from 'node:fs/promises';
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
      charset: 'ascii', // escapes non-ASCII in strings/identifiers (but NOT regex)
      logLevel: 'info',
      define: { 'process.env.NODE_ENV': '"production"' },
    });
  }
  await asciifyOutputs();
}

// Chrome's content-script loader rejects files containing raw multibyte UTF-8
// ("It isn't UTF-8 encoded"). esbuild's charset:ascii misses characters inside
// regex literals (e.g. accented ranges in a bundled lib), so escape every
// remaining non-ASCII UTF-16 code unit to \uXXXX. This is semantically
// identical inside strings, regex, and identifiers, and yields a pure-ASCII
// (always loadable) bundle.
function asciify(src) {
  let out = '';
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i);
    out += code > 0x7f ? '\\u' + code.toString(16).padStart(4, '0') : src[i];
  }
  return out;
}

async function asciifyOutputs() {
  for (const e of entries) {
    const p = r(e.out);
    const src = await readFile(p, 'utf8');
    const ascii = asciify(src);
    if (ascii !== src) await writeFile(p, ascii, 'utf8');
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
