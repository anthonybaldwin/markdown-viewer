// mathrender.js — render KaTeX into the inert placeholders produced by
// markdown.js. This runs AFTER sanitization, so the TeX source has only ever
// existed as plain text content. KaTeX itself executes no script; we also set
// trust:false so \href / \htmlData / \includegraphics are ignored.

import katex from 'katex';
import 'katex/contrib/mhchem'; // enables \ce{...} and \pu{...} for chemistry

// Shared, safe macro set. Users' documents can't define network/script macros.
const MACROS = {
  '\\RR': '\\mathbb{R}',
  '\\NN': '\\mathbb{N}',
  '\\ZZ': '\\mathbb{Z}',
  '\\QQ': '\\mathbb{Q}',
  '\\CC': '\\mathbb{C}',
};

export function renderMathIn(root) {
  const nodes = root.querySelectorAll('.mdv-math');
  let count = 0;
  nodes.forEach((el) => {
    if (el.dataset.mdvRendered) return;
    const tex = el.textContent;
    const display = el.classList.contains('mdv-math--display');
    try {
      katex.render(tex, el, {
        displayMode: display,
        throwOnError: false,
        errorColor: '#e11d48',
        trust: false,
        strict: 'ignore',
        output: 'htmlAndMathml',
        macros: MACROS,
        maxExpand: 1000,
      });
      el.dataset.mdvRendered = '1';
      count++;
    } catch (e) {
      el.classList.add('mdv-math--error');
      el.textContent = tex;
      el.title = String(e && e.message ? e.message : e);
    }
  });
  return count;
}
