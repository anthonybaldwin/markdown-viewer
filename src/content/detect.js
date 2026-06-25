// detect.js — decide whether the current document is *raw* markdown we should
// take over, and pull out its source text. Shared by the lightweight detector
// content script and the full renderer.

const MD_EXTENSIONS = [
  'md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdwn', 'mdtxt', 'mdtext',
  'rmd', 'qmd', 'ronn', 'workbook',
];

const MD_CONTENT_TYPES = [
  'text/markdown', 'text/x-markdown', 'text/x-web-markdown', 'application/markdown',
];

const PLAINISH_CONTENT_TYPES = ['text/plain', 'application/octet-stream', ''];

function pathHasMarkdownExtension(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    const dot = path.lastIndexOf('.');
    if (dot === -1) return false;
    const ext = path.slice(dot + 1);
    return MD_EXTENSIONS.includes(ext);
  } catch {
    return false;
  }
}

// Best-effort HTTP status of the top-level navigation, via Navigation Timing.
// Returns null when unknown (file://, no entry, cross-origin opaque) so callers
// fall back to rendering rather than blocking.
function navigationStatus() {
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    const status = nav && nav.responseStatus;
    return typeof status === 'number' && status > 0 ? status : null;
  } catch {
    return null;
  }
}

// Heuristic: does this plain-text payload look like Markdown? Used only for
// allowlisted, extension-less plain-text pages — some docs sites (e.g.
// Anthropic's) serve raw .md content at URLs that don't end in a markdown
// extension. Deliberately conservative: require several distinct structural
// markers so we don't hijack arbitrary prose, logs, or source files.
function looksLikeMarkdown(text) {
  if (!text) return false;
  const sample = text.slice(0, 8000);
  let score = 0;
  if (/^#{1,6}[ \t]+\S/m.test(sample)) score += 2;                 // ATX heading
  if (/^[ \t]*(```|~~~)/m.test(sample)) score += 2;                // fenced code block
  if (/^[ \t]*([-*+]|\d+\.)[ \t]+\S/m.test(sample)) score += 1;    // list item
  if (/^>[ \t]?\S/m.test(sample)) score += 1;                      // blockquote
  if (/^\|.+\|[ \t]*$/m.test(sample) &&
      /^[ \t]*\|?[ \t:|-]*-{3,}[ \t:|-]*$/m.test(sample)) score += 2; // table
  if (/!\[[^\]]*\]\([^)\s]+\)/.test(sample)) score += 1;           // image
  if (/(^|[^!])\[[^\]]+\]\([^)\s]+\)/.test(sample)) score += 1;    // link
  if (/(\*\*|__)\S[\s\S]*?\1/.test(sample)) score += 1;            // bold
  if (/`[^`\n]+`/.test(sample)) score += 1;                        // inline code
  return score >= 3;
}

// Is this a raw markdown document (as opposed to a normal HTML page)?
export function isMarkdownCandidate(doc = document) {
  // Never take over an error response (404 page, etc.): the URL or content type
  // may still look like markdown, but the body is not the document we want.
  const status = navigationStatus();
  if (status !== null && (status < 200 || status >= 300)) return false;

  const ct = (doc.contentType || '').toLowerCase();
  if (MD_CONTENT_TYPES.includes(ct)) return true;

  if (PLAINISH_CONTENT_TYPES.includes(ct)) {
    // The URL itself names a markdown file — trust the extension.
    if (pathHasMarkdownExtension(doc.URL || location.href)) return true;
    // Otherwise sniff the body: some sites serve raw markdown as plain text at
    // extension-less URLs. Conservative, to avoid hijacking ordinary text.
    if (looksLikeMarkdown(getRawMarkdown(doc))) return true;
  }
  return false;
}

// Extract the raw markdown text from a browser-rendered plain-text document.
// Chrome wraps text/plain payloads in a single <pre>; we read that verbatim.
export function getRawMarkdown(doc = document) {
  const body = doc.body;
  if (!body) return '';
  const onlyPre =
    body.children.length === 1 && body.firstElementChild &&
    body.firstElementChild.tagName === 'PRE'
      ? body.firstElementChild
      : null;
  if (onlyPre) return onlyPre.textContent || '';
  // Fallback: whole-body text (handles odd wrappers without losing content).
  return body.textContent || '';
}
