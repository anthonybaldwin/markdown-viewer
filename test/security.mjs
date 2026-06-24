// security.mjs — prove the render→sanitize pipeline neutralises hostile
// markdown. Runs the real markdown.js + sanitize.js against a battery of XSS
// vectors under a jsdom DOM. Run: `bun run test/security.mjs`.

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://example.test/doc.md',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.navigator = dom.window.navigator;

const { renderMarkdown } = await import('../src/content/markdown.js');
const { sanitizeHtml } = await import('../src/content/sanitize.js');

const clean = (md) => sanitizeHtml(renderMarkdown(md));

let pass = 0;
let fail = 0;
const fails = [];

function check(name, condition) {
  if (condition) {
    pass++;
  } else {
    fail++;
    fails.push(name);
  }
}

// Inspect sanitized HTML as a real DOM. Plain TEXT containing "javascript:"
// is harmless; what matters is that no dangerous ELEMENT, event handler, or
// URL-bearing ATTRIBUTE survives. This is the accurate test.
const BAD_TAGS = [
  'script', 'iframe', 'object', 'embed', 'form', 'button', 'textarea',
  'base', 'meta', 'svg', 'math', 'frame', 'frameset', 'applet', 'link',
  'style', 'noscript',
];
const URL_ATTRS = [
  'href', 'src', 'action', 'data', 'background', 'poster', 'formaction',
  'xlink:href', 'cite', 'longdesc', 'srcset', 'ping',
];

function inspect(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const problems = [];
  const frag = tpl.content;
  frag.querySelectorAll(BAD_TAGS.join(',')).forEach((n) =>
    problems.push('element:' + n.tagName.toLowerCase())
  );
  frag.querySelectorAll('*').forEach((n) => {
    for (const attr of [...n.attributes]) {
      const name = attr.name.toLowerCase();
      const val = (attr.value || '').toLowerCase().replace(/[\s\x00-\x1f]/g, '');
      if (name.startsWith('on')) problems.push('handler:' + name);
      if (name === 'srcset' || name === 'ping') problems.push('attr:' + name);
      if (URL_ATTRS.includes(name)) {
        if (
          val.startsWith('javascript:') ||
          val.startsWith('vbscript:') ||
          val.startsWith('data:text/html') ||
          val.startsWith('data:application') ||
          val.startsWith('data:image/svg')
        ) {
          problems.push('url:' + name + '=' + val.slice(0, 24));
        }
      }
    }
  });
  return problems;
}

const XSS_VECTORS = [
  '<script>alert(1)</script>',
  '<img src=x onerror="alert(1)">',
  '<img src=x onerror=alert(1)>',
  '[click me](javascript:alert(1))',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="  javascript:alert(1)">spaces</a>',
  '<a href="java&#115;cript:alert(1)">entity</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<svg onload=alert(1)></svg>',
  '<svg><script>alert(1)</script></svg>',
  '<iframe src="https://evil.example"></iframe>',
  '<details open ontoggle=alert(1)>x</details>',
  '![img](javascript:alert(1))',
  '<math href="javascript:alert(1)">x</math>',
  '<style>@import url(evil.css);</style>',
  '<style>body{background:url(javascript:alert(1))}</style>',
  '[x](data:text/html,<script>alert(1)</script>)',
  '<base href="https://evil.example/">',
  '<form><button formaction="javascript:alert(1)">go</button></form>',
  '<input type="image" src="javascript:alert(1)">',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  '<a href="#" onclick="alert(1)">x</a>',
  '<p style="background:url(javascript:alert(1))">x</p>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
  '<a href="\tjavascript:alert(1)">tab</a>',
  '<table background="javascript:alert(1)"><tr><td>x</td></tr></table>',
  '<video src="javascript:alert(1)" poster="javascript:alert(1)"></video>',
  '<video><source src="javascript:alert(1)"></video>',
  '<audio src="javascript:alert(1)"></audio>',
];

for (const vec of XSS_VECTORS) {
  const problems = inspect(clean(vec));
  check(`"${vec.slice(0, 44)}" → no executable residue (${problems.join(', ')})`, problems.length === 0);
}

// Inline-code and fenced content must stay inert text, never live HTML.
check(
  'inline code keeps script as text',
  !clean('`<script>alert(1)</script>`').toLowerCase().includes('<script')
);
check(
  'fenced code keeps script as text',
  !clean('```\n<script>alert(1)</script>\n```').toLowerCase().includes('<script')
);

// ---- positive: features still work ----
const math = clean('Energy is $E=mc^2$ and $$\\int_0^1 x\\,dx$$.');
check('math placeholder emitted', math.includes('mdv-math'));
check('math source preserved as text', math.includes('E=mc^2'));

const code = clean('```js\nconsole.log("hi")\n```');
check('code block class present', code.includes('mdv-code'));
check('code highlighted', code.includes('hljs'));

const mermaid = clean('```mermaid\ngraph TD; A-->B\n```');
check('mermaid block emitted', mermaid.includes('mdv-mermaid'));
check('mermaid source preserved', mermaid.includes('graph TD'));

const link = clean('[site](https://example.com)');
check('external link gets safe rel', link.includes('noopener') && link.includes('noreferrer'));
check('external link opens new tab', link.includes('target="_blank"'));

const table = clean('| a | b |\n|---|---|\n| 1 | 2 |');
check('tables render', table.includes('<table'));

const task = clean('- [x] done\n- [ ] todo');
check('task list checkbox present', task.includes('type="checkbox"'));
check('task list checkbox disabled', task.includes('disabled'));

const heading = clean('# Hello World');
check('heading gets id for TOC', /<h1[^>]*id="hello-world"/.test(heading));

const gfm = clean('~~struck~~ and www.example.com');
check('strikethrough works', gfm.includes('<s>') || gfm.includes('<del>'));

const footnote = clean('Text[^1]\n\n[^1]: A note.');
check('footnotes render', footnote.includes('footnote'));

const img = clean('![alt](https://example.com/a.png)');
check('safe image kept', img.includes('<img') && img.includes('a.png'));
check('image gets lazy loading', img.includes('loading="lazy"'));

const dataimg = clean('![x](data:image/png;base64,iVBORw0KGgo=)');
check('data:image png allowed', dataimg.includes('data:image/png'));

// HTML5 media: <video>/<audio>/<source> are safe (no script, URL schemes are
// scheme-checked) so they survive sanitization for genuine embeds.
const video = clean('<video controls src="https://example.com/v.mp4"></video>');
check('safe video kept', video.includes('<video') && video.includes('v.mp4'));
const vsrc = clean('<video controls><source src="https://example.com/v.mp4" type="video/mp4"></video>');
check('video <source> kept', vsrc.includes('<source') && vsrc.includes('v.mp4'));
const audio = clean('<audio controls src="https://example.com/a.mp3"></audio>');
check('safe audio kept', audio.includes('<audio') && audio.includes('a.mp3'));

// YouTube: a link ALONE on its own line becomes an inert click-to-load facade
// (thumbnail + play button) — never a live <iframe>, which stays forbidden.
const yt = clean('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
check('standalone youtube becomes embed facade', yt.includes('mdv-embed-youtube'));
check('youtube facade carries the video id', yt.includes('dQw4w9WgXcQ'));
check('youtube facade is iframe-free', !yt.toLowerCase().includes('<iframe'));
const ytShort = clean('https://youtu.be/dQw4w9WgXcQ');
check('youtu.be short link becomes embed facade', ytShort.includes('mdv-embed-youtube'));
// An inline youtube link inside a sentence is left as an ordinary link.
const ytInline = clean('Watch https://youtu.be/dQw4w9WgXcQ now.');
check('inline youtube link is NOT converted', !ytInline.includes('mdv-embed') && ytInline.includes('<a'));

const alert = clean('> [!WARNING]\n> Be careful here.');
check('alert callout emitted', alert.includes('mdv-alert mdv-alert-warning'));
check('alert title + icon emitted', alert.includes('mdv-alert-icon') && alert.includes('>Warning<'));
check('alert body preserved', alert.includes('Be careful here.'));
check('alert no leftover marker', !alert.includes('[!WARNING]'));
const notAlert = clean('> [!BOGUS]\n> text');
check('unknown alert type stays a blockquote', notAlert.includes('<blockquote') && notAlert.includes('[!BOGUS]'));

// ---- report ----
console.log(`\nSecurity pipeline: ${pass} passed, ${fail} failed\n`);
if (fail) {
  console.log('FAILURES:');
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
} else {
  console.log('✓ all checks passed — no executable content survives sanitization');
}
