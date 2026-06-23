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
      // With htmlLabels:false every label is a native SVG <text> instead of an
      // HTML box in a <foreignObject>. GitHub keeps HTML labels, so its layout
      // reserves space for the (wider) label boxes and the graph spreads out on
      // its own. Our labels are under-measured by the layout, so edge/node
      // labels crowd and overlap. Compensate by giving the layout more room:
      // wider gaps between sibling nodes (nodeSpacing) and between ranks
      // (rankSpacing), plus a little more node padding so text doesn't kiss the
      // box border. This approximates GitHub's roomier, auto-spaced look.
      flowchart: {
        htmlLabels: false,
        useMaxWidth: true,
        nodeSpacing: 64,
        rankSpacing: 64,
        padding: 14,
      },
      class: { htmlLabels: false, useMaxWidth: true },
      state: { htmlLabels: false, useMaxWidth: true },
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
