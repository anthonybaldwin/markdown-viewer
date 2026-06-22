// markdown.js — configure markdown-it with an extensive (and safe) feature set.
//
// SECURITY MODEL (read this before changing anything):
//   1. This module produces UNTRUSTED HTML. It is never inserted into the page
//      directly. Everything passes through sanitize.js (DOMPurify) first.
//   2. Math is NOT rendered here. We only emit inert placeholder <span>s whose
//      text content is the raw TeX. KaTeX runs *after* sanitization, on trusted
//      placeholders, so malicious TeX only ever exists as plain text.
//   3. Mermaid is NOT rendered here. Fenced ```mermaid blocks become an inert
//      <div class="mdv-mermaid"> whose text content is the diagram source.
//   4. Syntax highlighting emits <span class="hljs-*"> only — no scripts, no
//      inline event handlers — and is still re-checked by DOMPurify afterwards.

import MarkdownIt from 'markdown-it';
import texmath from 'markdown-it-texmath';
import footnote from 'markdown-it-footnote';
import deflist from 'markdown-it-deflist';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import mark from 'markdown-it-mark';
import ins from 'markdown-it-ins';
import abbr from 'markdown-it-abbr';
import { full as emoji } from 'markdown-it-emoji';
import { tasklist } from '@mdit/plugin-tasklist';
import hljs from 'highlight.js/lib/common';

// A few extra languages beyond the "common" bundle that matter for scientific
// and infra documents.
import julia from 'highlight.js/lib/languages/julia';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import nginx from 'highlight.js/lib/languages/nginx';
import toml from 'highlight.js/lib/languages/ini'; // TOML highlights well as ini
import scala from 'highlight.js/lib/languages/scala';
import haskell from 'highlight.js/lib/languages/haskell';
import matlab from 'highlight.js/lib/languages/matlab';
import latex from 'highlight.js/lib/languages/latex';

hljs.registerLanguage('julia', julia);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('toml', toml);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('haskell', haskell);
hljs.registerLanguage('matlab', matlab);
hljs.registerLanguage('latex', latex);
hljs.registerAliases(['tex'], { languageName: 'latex' });

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Placeholder "engine" for markdown-it-texmath. Instead of rendering KaTeX at
// parse time (which would force us to allow KaTeX's inline styles & MathML
// through the sanitizer), we emit an inert span carrying the raw TeX as text.
// KaTeX renders these later, in mathrender.js, from trusted code.
const mathPlaceholderEngine = {
  renderToString(tex, opts) {
    const display = !!(opts && opts.displayMode);
    return (
      '<span class="mdv-math' +
      (display ? ' mdv-math--display' : '') +
      '">' +
      escapeHtml(tex) +
      '</span>'
    );
  },
};

function highlight(code, lang) {
  const language = (lang || '').trim().toLowerCase();

  // Mermaid: hand off the raw source as inert text for later rendering.
  if (language === 'mermaid') {
    return '<div class="mdv-mermaid">' + escapeHtml(code) + '</div>';
  }

  let inner;
  let detected = language;
  try {
    if (language && hljs.getLanguage(language)) {
      inner = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } else {
      // No (or unknown) language: don't auto-detect (slow + often wrong),
      // just escape. Still wrapped so styling/copy works.
      inner = escapeHtml(code);
      detected = '';
    }
  } catch {
    inner = escapeHtml(code);
    detected = '';
  }

  const langAttr = detected ? ' data-lang="' + escapeHtml(detected) + '"' : '';
  // Returning a full <pre> tells markdown-it to use this verbatim.
  return (
    '<pre class="mdv-code hljs"><code' +
    langAttr +
    '>' +
    inner +
    '</code></pre>'
  );
}

export function createRenderer(opts = {}) {
  const md = new MarkdownIt({
    html: true, // raw HTML is allowed here, then neutralised by DOMPurify
    xhtmlOut: false,
    breaks: !!opts.breaks,
    linkify: opts.linkify !== false,
    typographer: opts.typographer !== false,
    highlight,
  });

  md.use(texmath, {
    engine: mathPlaceholderEngine,
    delimiters: ['dollars', 'brackets'], // $..$  $$..$$  \(..\)  \[..\]
  });

  md.use(footnote);
  md.use(deflist);
  md.use(sub);
  md.use(sup);
  md.use(mark);
  md.use(ins);
  md.use(abbr);
  md.use(emoji);
  md.use(tasklist, { disabled: true, label: false });

  // Add header anchors so the table of contents and deep links work.
  md.core.ruler.push('mdv_heading_ids', (state) => {
    const used = Object.create(null);
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'heading_open') continue;
      const inline = tokens[i + 1];
      const text = inline && inline.type === 'inline' ? inline.content : '';
      let slug = slugify(text);
      if (!slug) slug = 'section';
      if (used[slug] != null) {
        used[slug] += 1;
        slug = slug + '-' + used[slug];
      } else {
        used[slug] = 0;
      }
      tokens[i].attrSet('id', slug);
    }
    return true;
  });

  return md;
}

function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\wÀ-￿ \-]/g, '') // keep word chars, unicode letters, space, hyphen
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

let _shared = null;
export function renderMarkdown(src, opts) {
  if (!_shared) _shared = createRenderer(opts);
  return _shared.render(src);
}
