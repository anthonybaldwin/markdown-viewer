// ui.js — build the reading chrome around sanitized article HTML and wire up
// interactions: table-of-contents rail, scroll-spy, reading progress, copy
// buttons, heading anchors, width/theme/raw/print controls.

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>',
  wide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
  narrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="4" width="10" height="16" rx="1.5"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5h-2M8 14h8v7H8z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
};

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'html') node.innerHTML = v; // trusted icon markup only
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  if (children) for (const c of [].concat(children)) if (c) node.appendChild(c);
  return node;
}

function button({ icon, label, title, pressed, id }) {
  const b = el('button', {
    class: 'mdv-btn',
    type: 'button',
    title,
    'aria-label': title,
    'data-id': id,
  });
  if (pressed != null) b.setAttribute('aria-pressed', String(pressed));
  b.innerHTML = ICONS[icon] || '';
  if (label) b.appendChild(el('span', { class: 'mdv-btn-label', text: label }));
  return b;
}

// Build the full viewer DOM. `safeHtml` is already sanitized.
export function buildViewer({ safeHtml, rawSource, title, settings }) {
  const root = el('div', { class: 'mdv-root' });

  // Gutter Snake — progress that traces the top & left edges.
  const snakeLeft = el('div', { class: 'mdv-snake-left' });
  const snakeFill = el('div', { class: 'mdv-snake-fill' });
  const snakeTop = el('div', { class: 'mdv-snake-top' }, [snakeFill]);

  const railToggle = button({ icon: 'menu', title: 'Toggle contents', id: 'rail' });
  railToggle.classList.add('mdv-rail-toggle');

  const barDot = el('span', {
    class: 'mdv-bar-dot',
    role: 'button',
    tabindex: '0',
    title: 'Shuffle accent color',
    'aria-label': 'Shuffle accent color',
  });
  const titleEl = el('div', { class: 'mdv-bar-title' }, [
    barDot,
    el('b', { text: title || 'Markdown' }),
  ]);

  const themeBtn = button({ icon: 'auto', title: 'Theme', id: 'theme' });
  const widthBtn = button({ icon: 'wide', title: 'Reading width', id: 'width' });
  const rawBtn = button({ icon: 'code', title: 'View source', id: 'raw', pressed: false });
  const printBtn = button({ icon: 'print', title: 'Print', id: 'print' });

  const bar = el('header', { class: 'mdv-bar' }, [
    railToggle,
    titleEl,
    el('div', { class: 'mdv-bar-spacer' }),
    el('div', { class: 'mdv-bar-actions' }, [widthBtn, themeBtn, rawBtn, printBtn]),
  ]);

  const tocNav = el('nav', { class: 'mdv-toc', 'aria-label': 'Table of contents' });
  const rail = el('aside', { class: 'mdv-rail' }, [
    el('div', { class: 'mdv-rail-label', text: 'Contents' }),
    tocNav,
  ]);
  const scrim = el('div', { class: 'mdv-rail-scrim' });

  const article = el('article', { class: 'mdv-article' });
  article.innerHTML = safeHtml; // sanitized upstream

  const rawPre = el('pre', { class: 'mdv-raw', hidden: true });
  rawPre.textContent = rawSource;

  const main = el('main', { class: 'mdv-main' }, [article, rawPre]);

  const layout = el('div', { class: 'mdv-layout' }, [rail, scrim, main]);
  layout.setAttribute('data-width', settings.width === 'full' ? 'full' : 'comfortable');

  root.append(snakeLeft, snakeTop, bar, layout);

  const refs = {
    root, layout, article, rawPre, tocNav, snakeFill, snakeLeft, barDot,
    themeBtn, widthBtn, rawBtn, printBtn, railToggle, scrim,
  };
  enhance(refs, settings);
  return refs;
}

function enhance(refs, settings) {
  const { article, tocNav, layout, root } = refs;

  // Heading anchors + TOC entries
  const headings = [...article.querySelectorAll('h1, h2, h3, h4')].filter((h) => h.id);
  if (!headings.length || settings.toc === false) {
    layout.setAttribute('data-toc', 'off');
  } else {
    for (const h of headings) {
      const level = Number(h.tagName[1]);
      const anchor = el('a', { class: 'mdv-anchor', href: '#' + h.id, 'aria-hidden': 'true', tabindex: '-1', text: '#' });
      h.insertBefore(anchor, h.firstChild);
      const link = el('a', { href: '#' + h.id, 'data-level': String(level), text: h.textContent.replace(/^#/, '').trim() });
      tocNav.appendChild(link);
    }
  }

  // Copy buttons on code blocks
  for (const pre of article.querySelectorAll('pre.mdv-code')) {
    const btn = el('button', { class: 'mdv-copy', type: 'button', title: 'Copy code' });
    btn.innerHTML = ICONS.copy + '<span>Copy</span>';
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      const text = code ? code.innerText : pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const r = document.createRange();
        r.selectNodeContents(code || pre);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        try { document.execCommand('copy'); } catch {}
        sel.removeAllRanges();
      }
      btn.classList.add('is-done');
      btn.innerHTML = ICONS.check + '<span>Copied</span>';
      setTimeout(() => {
        btn.classList.remove('is-done');
        btn.innerHTML = ICONS.copy + '<span>Copy</span>';
      }, 1400);
    });
    pre.appendChild(btn);
  }

  // Wrap tables for horizontal scroll
  for (const table of article.querySelectorAll('table')) {
    if (table.parentElement && table.parentElement.classList.contains('mdv-table-wrap')) continue;
    const wrap = el('div', { class: 'mdv-table-wrap' });
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  }

  // Smooth in-page anchor scrolling
  root.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + id);
    if (matchMedia('(max-width: 1080px)').matches) root.removeAttribute('data-rail-open');
  });

  setupScrollSpy(refs, headings);
}

function setupScrollSpy(refs, headings) {
  const { tocNav, snakeFill, snakeLeft } = refs;
  const links = new Map();
  for (const a of tocNav.querySelectorAll('a')) {
    links.set(decodeURIComponent(a.getAttribute('href').slice(1)), a);
  }

  // Gutter Snake: the top leg grows across the full scroll range; the left leg
  // holds at 100% until LEFT_START%, then drains to 0 over the remaining span.
  const LEFT_START = 70;

  let ticking = false;
  const update = () => {
    ticking = false;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docH > 0 ? Math.min(100, Math.max(0, (scrollTop / docH) * 100)) : 0;
    snakeFill.style.width = pct + '%';
    const leftPct =
      pct <= LEFT_START ? 100 : 100 - ((pct - LEFT_START) / (100 - LEFT_START)) * 100;
    snakeLeft.style.height = leftPct + '%';

    // active heading = last heading whose top is above the fold line
    const line = 90;
    let active = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top - line <= 0) active = h;
      else break;
    }
    if (!active && headings.length) active = headings[0];
    for (const a of links.values()) a.classList.remove('is-active');
    if (active && links.has(active.id)) {
      const a = links.get(active.id);
      a.classList.add('is-active');
      // keep active item visible in the rail
      const rail = refs.root.querySelector('.mdv-rail');
      if (rail) {
        const ar = a.getBoundingClientRect();
        const rr = rail.getBoundingClientRect();
        if (ar.top < rr.top + 40 || ar.bottom > rr.bottom - 40) {
          a.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

// Wire the toolbar buttons. Callbacks let callers persist state / re-render.
// Returns a small controller so external changes can drive the theme button.
export function wireToolbar(refs, opts = {}) {
  const {
    initialTheme = 'auto',
    initialWidth = 'comfortable',
    onTheme = () => {},
    onWidth = () => {},
  } = opts;

  const themeOrder = ['auto', 'light', 'dark'];
  const themeIcon = { auto: 'auto', light: 'sun', dark: 'moon' };
  let mode = themeOrder.includes(initialTheme) ? initialTheme : 'auto';

  const paintTheme = () => {
    refs.themeBtn.innerHTML = ICONS[themeIcon[mode]];
    refs.themeBtn.appendChild(el('span', { class: 'mdv-btn-label', text: mode }));
    refs.themeBtn.title = 'Theme: ' + mode;
  };
  refs.themeBtn.addEventListener('click', () => {
    mode = themeOrder[(themeOrder.indexOf(mode) + 1) % themeOrder.length];
    paintTheme();
    onTheme(mode);
  });

  let width = initialWidth === 'full' ? 'full' : 'comfortable';
  const paintWidth = () => {
    refs.layout.setAttribute('data-width', width);
    refs.widthBtn.innerHTML = ICONS[width === 'full' ? 'narrow' : 'wide'];
    refs.widthBtn.appendChild(el('span', { class: 'mdv-btn-label', text: width === 'full' ? 'Narrow' : 'Wide' }));
  };
  refs.widthBtn.addEventListener('click', () => {
    width = width === 'full' ? 'comfortable' : 'full';
    paintWidth();
    onWidth(width);
  });

  refs.rawBtn.addEventListener('click', () => {
    const showRaw = refs.rawPre.hasAttribute('hidden');
    refs.rawPre.toggleAttribute('hidden', !showRaw);
    refs.article.style.display = showRaw ? 'none' : '';
    refs.rawBtn.setAttribute('aria-pressed', String(showRaw));
  });
  refs.printBtn.addEventListener('click', () => window.print());
  refs.railToggle.addEventListener('click', () => {
    const open = refs.root.getAttribute('data-rail-open') === '1';
    refs.root.setAttribute('data-rail-open', open ? '0' : '1');
  });
  refs.scrim.addEventListener('click', () => refs.root.setAttribute('data-rail-open', '0'));

  paintTheme();
  paintWidth();
  onTheme(mode); // apply initial theme

  return {
    getMode: () => mode,
    setMode: (m) => {
      if (!themeOrder.includes(m) || m === mode) return;
      mode = m;
      paintTheme();
      onTheme(mode);
    },
    setWidth: (w) => {
      width = w === 'full' ? 'full' : 'comfortable';
      paintWidth();
    },
  };
}
