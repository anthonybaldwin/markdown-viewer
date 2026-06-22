// preview-entry.js — dev-only demo that drives the real render pipeline so the
// viewer can be seen without installing the extension. The sample is fetched as
// a real .md file and sanitized exactly as the extension would; Mermaid comes
// from the built dist/mermaid.js (loaded via <script> in preview.html).

import { renderMarkdown } from '../src/content/markdown.js';
import { sanitizeHtml, sanitizeSvg } from '../src/content/sanitize.js';
import { renderMathIn } from '../src/content/mathrender.js';
import { buildViewer, wireToolbar } from '../src/content/ui.js';
import { randomHue, applyAccent, wireAccentReroll } from '../src/content/accent.js';

const settings = {
  theme: 'auto', width: 'comfortable', toc: true, mermaid: true,
  typographer: true, linkify: true, breaks: false, softWrapCode: false,
};

const res = await fetch(new URL('sample.md', location.href));
const src = await res.text();

const safeHtml = sanitizeHtml(renderMarkdown(src, settings));
const refs = buildViewer({ safeHtml, rawSource: src, title: 'showcase.md', settings });

document.body.style.margin = '0';
document.body.replaceChildren(refs.root);
document.documentElement.setAttribute('data-mdv', '1');

let cards = [];
const resolve = (m) =>
  m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';

async function reRender(list, dark) {
  const api = globalThis.__mdvMermaid;
  if (!api) return;
  api.init(dark);
  for (const c of list) {
    const s = c.dataset.mdvSrc;
    if (!s) continue;
    try { c.innerHTML = sanitizeSvg(await api.render(s)); } catch {}
  }
}

let hue = randomHue();
const applyTheme = (mode) => {
  const dark = resolve(mode) === 'dark';
  refs.root.setAttribute('data-theme', resolve(mode));
  applyAccent(refs.root, hue, dark);
  reRender(cards, dark);
};

const ctl = wireToolbar(refs, {
  initialTheme: settings.theme,
  initialWidth: settings.width,
  onTheme: applyTheme,
  onWidth: () => {},
});
wireAccentReroll(refs.barDot, (newHue) => {
  hue = newHue;
  applyAccent(refs.root, hue, resolve(ctl.getMode()) === 'dark');
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (ctl.getMode() === 'auto') applyTheme('auto');
});

renderMathIn(refs.article);

const api = globalThis.__mdvMermaid;
if (api) {
  api.init(resolve(ctl.getMode()) === 'dark');
  for (const block of refs.article.querySelectorAll('.mdv-mermaid')) {
    const source = block.textContent;
    try {
      const card = document.createElement('div');
      card.className = 'mdv-mermaid-card';
      card.dataset.mdvSrc = source;
      card.innerHTML = sanitizeSvg(await api.render(source));
      block.replaceWith(card);
      cards.push(card);
    } catch {
      block.classList.add('mdv-mermaid--raw');
    }
  }
}
