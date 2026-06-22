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

// Is this a raw markdown document (as opposed to a normal HTML page)?
export function isMarkdownCandidate(doc = document) {
  const ct = (doc.contentType || '').toLowerCase();
  if (MD_CONTENT_TYPES.includes(ct)) return true;

  // text/plain (and friends) only when the URL itself names a markdown file —
  // this avoids hijacking arbitrary plain-text or HTML pages.
  if (PLAINISH_CONTENT_TYPES.includes(ct) && pathHasMarkdownExtension(doc.URL || location.href)) {
    return true;
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
