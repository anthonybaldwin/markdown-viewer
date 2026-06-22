// main.js — content entry point. Detect raw markdown, render it through the
// safe pipeline, replace the page with the reading UI, and wire interactions.
//
// Injection order of trust:
//   raw text -> markdown-it (untrusted HTML) -> DOMPurify (safe HTML) -> DOM
//   math & mermaid render AFTER sanitization, from trusted code only.

import { renderMarkdown } from './markdown.js';
import { sanitizeHtml, sanitizeSvg } from './sanitize.js';
import { renderMathIn } from './mathrender.js';
import { isMarkdownCandidate, getRawMarkdown } from './detect.js';
import { buildViewer, wireToolbar } from './ui.js';
import { randomHue, applyAccent, wireAccentReroll } from './accent.js';
import { getSettings, setSettings, onChanged } from '../common/storage.js';

const FLAG = '__mdvActive';

function resolveTheme(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function filenameFromUrl() {
  try {
    const p = new URL(location.href).pathname;
    const base = decodeURIComponent(p.split('/').pop() || '');
    return base || location.host || 'Markdown';
  } catch {
    return 'Markdown';
  }
}

function injectHead() {
  const head = document.head || document.documentElement;
  const add = (tag, attrs) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    head.appendChild(n);
    return n;
  };
  if (!document.querySelector('meta[name="viewport"][data-mdv]')) {
    add('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1', 'data-mdv': '1' });
  }
  const css = [
    chrome.runtime.getURL('vendor/katex/katex.min.css'),
    chrome.runtime.getURL('src/content/viewer.css'),
  ];
  for (const href of css) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    add('link', { rel: 'stylesheet', href });
  }
}

async function injectMermaidLib() {
  if (globalThis.__mdvMermaid) return globalThis.__mdvMermaid;
  try {
    await chrome.runtime.sendMessage({ type: 'mdv-need-mermaid' });
  } catch {
    return null;
  }
  return globalThis.__mdvMermaid || null;
}

async function renderMermaid(article, dark) {
  const blocks = [...article.querySelectorAll('.mdv-mermaid')];
  if (!blocks.length) return [];
  const api = await injectMermaidLib();
  if (!api) return [];
  api.init(dark);
  const rendered = [];
  for (const block of blocks) {
    const source = block.textContent;
    try {
      const svg = await api.render(source);
      const card = document.createElement('div');
      card.className = 'mdv-mermaid-card';
      card.dataset.mdvSrc = source;
      card.innerHTML = sanitizeSvg(svg); // SVG scrubbed before injection
      block.replaceWith(card);
      rendered.push(card);
    } catch (e) {
      block.classList.add('mdv-mermaid--raw');
      block.title = String((e && e.message) || e);
    }
  }
  return rendered;
}

async function reRenderMermaid(cards, dark) {
  const api = globalThis.__mdvMermaid;
  if (!api || !cards.length) return;
  api.init(dark);
  for (const card of cards) {
    const source = card.dataset.mdvSrc;
    if (!source) continue;
    try {
      const svg = await api.render(source);
      card.innerHTML = sanitizeSvg(svg);
    } catch {}
  }
}

async function run() {
  if (window[FLAG]) return;
  if (!isMarkdownCandidate()) return;
  window[FLAG] = true;

  const settings = await getSettings();
  const raw = getRawMarkdown();

  const dirty = renderMarkdown(raw, {
    typographer: settings.typographer,
    linkify: settings.linkify,
    breaks: settings.breaks,
  });
  const safeHtml = sanitizeHtml(dirty);

  const title = filenameFromUrl();
  const refs = buildViewer({ safeHtml, rawSource: raw, title, settings });

  // Swap the page.
  injectHead();
  document.documentElement.setAttribute('data-mdv', '1');
  if (document.body) {
    document.body.style.margin = '0';
    document.body.replaceChildren(refs.root);
  }
  refs.root.setAttribute('data-soft-wrap', settings.softWrapCode ? '1' : '0');

  // First-heading title is nicer than the bare filename when available.
  const h1 = refs.article.querySelector('h1');
  document.title = (h1 && h1.textContent.trim()) || title;

  // ---- theme + accent + toolbar ----
  let mermaidCards = [];
  let hue = randomHue(); // fresh random accent per load; reroll by clicking the dot
  const applyResolvedTheme = (mode) => {
    const resolved = resolveTheme(mode);
    refs.root.setAttribute('data-theme', resolved);
    applyAccent(refs.root, hue, resolved === 'dark');
    reRenderMermaid(mermaidCards, resolved === 'dark');
  };

  const ctl = wireToolbar(refs, {
    initialTheme: settings.theme || 'auto',
    initialWidth: settings.width || 'comfortable',
    onTheme: (mode) => {
      applyResolvedTheme(mode);
      setSettings({ theme: mode });
    },
    onWidth: (w) => setSettings({ width: w }),
  });

  // Click the bar dot to shuffle the accent (recolors links, rail, snake,
  // and the text-selection highlight).
  wireAccentReroll(refs.barDot, (newHue) => {
    hue = newHue;
    applyAccent(refs.root, hue, resolveTheme(ctl.getMode()) === 'dark');
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (ctl.getMode() === 'auto') applyResolvedTheme('auto');
  });

  // ---- math ----
  try { renderMathIn(refs.article); } catch {}

  // ---- mermaid ----
  if (settings.mermaid !== false) {
    try {
      mermaidCards = await renderMermaid(refs.article, resolveTheme(ctl.getMode()) === 'dark');
    } catch {}
  }

  // React to settings changed elsewhere (options page): theme + width live.
  onChanged(async () => {
    const s = await getSettings();
    ctl.setMode(s.theme);
    ctl.setWidth(s.width);
    refs.root.setAttribute('data-soft-wrap', s.softWrapCode ? '1' : '0');
  });
}

run();
