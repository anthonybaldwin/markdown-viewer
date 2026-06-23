// mermaid-entry.js — bundled separately and injected on demand (it's large).
// Exposes a tiny render API on the shared isolated-world global. Mermaid runs
// in strict security mode; the produced SVG is still re-sanitized by the caller.

import mermaid from 'mermaid';

let counter = 0;

globalThis.__mdvMermaid = {
  init(dark) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict', // no click handlers, no raw HTML labels
      theme: dark ? 'dark' : 'default',
      fontFamily: 'inherit',
      // CRITICAL: render every label as native SVG <text>, never as HTML wrapped
      // in <foreignObject>. Our SVG sanitizer (sanitize.js) strips <foreignObject>
      // as an XSS vector, so any HTML label would be silently deleted — leaving
      // empty node/cluster boxes. The per-diagram `flowchart.htmlLabels` flag is
      // NOT enough: in Mermaid 11 it only covers flowchart *edge* labels, while
      // node, class, state and ER labels still emit <foreignObject> unless the
      // top-level `htmlLabels` is also false. Keep BOTH set.
      htmlLabels: false,
      flowchart: { htmlLabels: false, useMaxWidth: true },
      class: { htmlLabels: false },
      state: { htmlLabels: false },
      er: { useMaxWidth: true },
      sequence: { useMaxWidth: true },
    });
  },
  async render(source) {
    const id = 'mdv-mermaid-' + counter++;
    const { svg } = await mermaid.render(id, source);
    return svg;
  },
};
