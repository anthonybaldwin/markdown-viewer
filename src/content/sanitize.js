// sanitize.js — the single hard security gate.
//
// Every byte of rendered markdown passes through DOMPurify here before it ever
// touches the live DOM. The configuration is deliberately strict: no scripting,
// no remote-loading vectors, no inline styles, no embedded frames/objects.

import DOMPurify from 'dompurify';

// Schemes we permit in href/src/etc. Note: NO data:, NO file:, NO blob:,
// NO javascript:/vbscript:. data:image is handled as a narrow exception below.
const SAFE_URI =
  /^(?:https?|mailto|tel|sms|geo|ftp|ftps|news|irc|ircs|magnet|xmpp):/i;
// Inline raster images via data: are allowed; SVG data URIs are NOT (script vector).
const SAFE_DATA_IMG =
  /^data:image\/(?:png|jpe?g|gif|webp|bmp|avif|x-icon|vnd\.microsoft\.icon)[;,]/i;

let installed = false;

function install() {
  if (installed) return;
  installed = true;

  // <a>: force safe rel, open externals in a new tab, drop dangerous targets.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      const isAnchor = href.startsWith('#');
      const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(href);
      node.setAttribute('rel', 'noopener noreferrer nofollow ugc');
      if (isExternal && !isAnchor) {
        node.setAttribute('target', '_blank');
      } else {
        node.removeAttribute('target');
      }
    }

    // Images: lazy + async, and never auto-load via referrer leak.
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.setAttribute('decoding', 'async');
      node.setAttribute('referrerpolicy', 'no-referrer');
    }

    // <input>: markdown task lists legitimately produce disabled checkboxes.
    // Force them inert and confine the type so a hand-written <input> can't be
    // abused (e.g. type=image src=... as a tracking/probe vector).
    if (node.tagName === 'INPUT') {
      const type = (node.getAttribute('type') || '').toLowerCase();
      if (type !== 'checkbox' && type !== 'radio') {
        node.parentNode && node.parentNode.removeChild(node);
        return;
      }
      node.setAttribute('disabled', '');
      ['src', 'formaction', 'onfocus', 'name', 'value'].forEach((a) =>
        node.removeAttribute(a)
      );
    }
  });

  // Belt-and-braces URL scheme enforcement on every URL-bearing attribute.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    for (const attr of ['href', 'src', 'xlink:href', 'action', 'background', 'poster', 'cite', 'longdesc']) {
      if (!node.hasAttribute || !node.hasAttribute(attr)) continue;
      const val = (node.getAttribute(attr) || '').trim();
      if (!val) continue;
      const lower = val.toLowerCase();
      const looksAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(val);
      if (!looksAbsolute) continue; // relative / anchor URLs are fine
      const ok =
        SAFE_URI.test(lower) ||
        ((attr === 'src' || attr === 'href') && SAFE_DATA_IMG.test(lower));
      if (!ok) node.removeAttribute(attr);
    }
  });
}

const CONFIG = {
  // Allow the breadth of HTML markdown can legitimately produce...
  USE_PROFILES: { html: true },
  // ...minus everything scriptable or remote-loading.
  FORBID_TAGS: [
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed',
    'base', 'link', 'meta', 'form', 'button', 'textarea', 'select', 'option',
    'noscript', 'template', 'portal', 'applet', 'param', 'math', 'svg',
  ],
  FORBID_ATTR: ['style', 'srcset', 'ping', 'integrity', 'nonce'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ADD_ATTR: ['target', 'id', 'colspan', 'rowspan', 'align', 'start', 'reversed', 'type'],
  KEEP_CONTENT: true,
  // SANITIZE_DOM guards against the dangerous DOM-clobbering cases. We do NOT
  // enable SANITIZE_NAMED_PROPS: it prefixes every id with "user-content-",
  // which would break heading anchors and footnote (#fn1) links. Clobbering an
  // id can't execute script once handlers/scripts are stripped.
  SANITIZE_DOM: true,
  WHOLE_DOCUMENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

// Sanitize untrusted markdown-rendered HTML -> safe HTML string.
export function sanitizeHtml(dirty) {
  install();
  return DOMPurify.sanitize(dirty, CONFIG);
}

// Sanitize TRUSTED-but-defense-in-depth SVG (Mermaid output). Mermaid is run in
// strict mode, but we still scrub its SVG before injecting it.
export function sanitizeSvg(dirtySvg) {
  install();
  return DOMPurify.sanitize(dirtySvg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject', 'a'],
    FORBID_ATTR: ['onload', 'onclick', 'onmouseover'],
    ADD_ATTR: ['transform', 'viewBox', 'preserveAspectRatio', 'class', 'd', 'points'],
    ALLOW_DATA_ATTR: false,
  });
}
