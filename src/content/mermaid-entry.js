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
      flowchart: { htmlLabels: false },
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
