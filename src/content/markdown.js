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
import { load as yamlLoad, FAILSAFE_SCHEMA } from 'js-yaml';
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

// ── GitHub-style alerts (admonitions) ───────────────────────────────────
// A blockquote whose first line is `[!NOTE]` (or TIP / IMPORTANT / WARNING /
// CAUTION) becomes a styled callout, the way GitHub's reading view renders it.
// We can't emit an inline <svg> icon — the sanitizer strips <svg> as an XSS
// vector — so the icon is drawn entirely from trusted CSS (viewer.css) via the
// `.mdv-alert-icon` class. The label text ("Note", …) is the accessible name.
const ALERT_LABELS = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
};

function alertPlugin(md) {
  // Runs after the block tokenizer but before inline parsing, so editing an
  // inline token's `.content` here is picked up when inline rules run later.
  md.core.ruler.after('block', 'mdv_alerts', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 2; i++) {
      if (tokens[i].type !== 'blockquote_open') continue;
      const paraOpen = tokens[i + 1];
      const inline = tokens[i + 2];
      if (paraOpen.type !== 'paragraph_open' || inline.type !== 'inline') continue;
      const m = /^\[!(note|tip|important|warning|caution)\][^\S\r\n]*(?:\r?\n|$)/i.exec(
        inline.content
      );
      if (!m) continue;
      const type = m[1].toLowerCase();

      // Retag the <blockquote> as <div class="mdv-alert mdv-alert-TYPE">.
      tokens[i].tag = 'div';
      tokens[i].attrSet('class', 'mdv-alert mdv-alert-' + type);
      // Retag the matching close, honouring nested blockquotes.
      let depth = 1;
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'blockquote_open') depth++;
        else if (tokens[j].type === 'blockquote_close' && --depth === 0) {
          tokens[j].tag = 'div';
          break;
        }
      }

      // Strip the `[!TYPE]` marker line from the first paragraph.
      inline.content = inline.content.slice(m[0].length);
      if (inline.content === '') {
        tokens.splice(i + 1, 3); // marker was alone — drop the now-empty <p>
      }

      // Inject the title (icon + label) as the alert's first child.
      const title = new state.Token('html_block', '', 0);
      title.content =
        '<p class="mdv-alert-title"><span class="mdv-alert-icon" aria-hidden="true"></span>' +
        ALERT_LABELS[type] +
        '</p>\n';
      tokens.splice(i + 1, 0, title);
    }
    return false;
  });
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
  md.use(alertPlugin);

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

// ── YAML front matter ───────────────────────────────────────────────────
// A `---` … `---` metadata block at the very top of a document is a near-
// universal convention (GitHub, Obsidian, Jekyll, Hugo, Pandoc). CommonMark
// doesn't define it, so without handling it the block mis-parses as a setext
// heading. We strip it from the body and render it as a metadata table, the
// way GitHub's reading view does.

// Split a leading YAML front-matter block from the body. Only matches when the
// document starts (optionally after a BOM) with `---` on its own line and has a
// matching closing `---` line. Returns { frontMatter, body }.
export function splitFrontMatter(src) {
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1); // strip a leading BOM
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { frontMatter: null, body: src };
  return { frontMatter: m[1], body: src.slice(m[0].length) };
}

function formatFrontMatterValue(v) {
  if (v == null || v === '') return '<span class="mdv-fm-empty">—</span>';
  if (Array.isArray(v)) {
    if (!v.length) return '<span class="mdv-fm-empty">—</span>';
    return (
      '<span class="mdv-fm-tags">' +
      v
        .map((item) =>
          item != null && typeof item === 'object'
            ? '<code>' + escapeHtml(JSON.stringify(item)) + '</code>'
            : '<span class="mdv-fm-tag">' + escapeHtml(String(item)) + '</span>'
        )
        .join('') +
      '</span>'
    );
  }
  if (typeof v === 'object') return '<code>' + escapeHtml(JSON.stringify(v)) + '</code>';
  // Scalars are kept as strings (FAILSAFE schema), so dates/numbers show verbatim.
  return escapeHtml(String(v));
}

function rawFrontMatterBlock(yamlText) {
  let inner;
  try {
    inner = hljs.highlight(yamlText, { language: 'yaml', ignoreIllegals: true }).value;
  } catch {
    inner = escapeHtml(yamlText);
  }
  return (
    '<pre class="mdv-code hljs mdv-frontmatter-raw"><code data-lang="yaml">' +
    inner +
    '</code></pre>'
  );
}

export function renderFrontMatter(yamlText) {
  let data;
  try {
    // FAILSAFE: keep every scalar as a string — no type coercion, dates/tags
    // render exactly as authored.
    data = yamlLoad(yamlText, { schema: FAILSAFE_SCHEMA });
  } catch {
    return rawFrontMatterBlock(yamlText); // malformed — show it, don't mangle it
  }
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return rawFrontMatterBlock(yamlText);
  }
  const entries = Object.entries(data);
  if (!entries.length) return '';
  const rows = entries
    .map(
      ([k, v]) =>
        '<tr><th scope="row">' + escapeHtml(k) + '</th><td>' + formatFrontMatterValue(v) + '</td></tr>'
    )
    .join('');
  return '<table class="mdv-frontmatter"><tbody>' + rows + '</tbody></table>';
}

let _shared = null;
export function renderMarkdown(src, opts) {
  if (!_shared) _shared = createRenderer(opts);
  const { frontMatter, body } = splitFrontMatter(src);
  const bodyHtml = _shared.render(body);
  return frontMatter != null ? renderFrontMatter(frontMatter) + bodyHtml : bodyHtml;
}
