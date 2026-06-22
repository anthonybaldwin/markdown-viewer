import {
  getSettings,
  setSettings,
  getAllowlist,
  addToAllowlist,
  removeFromAllowlist,
  urlToPattern,
  patternLabel,
} from '../common/storage.js';

const $ = (id) => document.getElementById(id);

function resolveDark(theme) {
  return theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', resolveDark(theme) ? 'dark' : 'light');
}

function inputToPattern(raw) {
  let s = (raw || '').trim();
  if (!s) return null;
  if (/^file:/i.test(s) || /^local/i.test(s)) return 'file:///*';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  return urlToPattern(s);
}

const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>';

async function renderSites() {
  const list = (await getAllowlist()).filter((p) => p !== 'file:///*');
  const ul = $('site-list');
  ul.replaceChildren();

  if (!list.length) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="empty">No websites added yet.</span>';
    ul.appendChild(li);
  } else {
    for (const pattern of list) {
      const li = document.createElement('li');
      const host = document.createElement('span');
      host.className = 'host';
      host.textContent = patternLabel(pattern);
      const btn = document.createElement('button');
      btn.className = 'btn btn-danger';
      btn.title = 'Remove';
      btn.innerHTML = TRASH;
      btn.addEventListener('click', async () => {
        await removeFromAllowlist(pattern);
        try { await chrome.permissions.remove({ origins: [pattern] }); } catch {}
        await refreshCounts();
        renderSites();
      });
      li.append(host, btn);
      ul.appendChild(li);
    }
  }

  // file toggle state
  const full = await getAllowlist();
  const granted = await chrome.permissions.contains({ origins: ['file:///*'] });
  $('file-toggle').checked = full.includes('file:///*') && granted;
  $('file-hint').innerHTML = granted
    ? 'Render <code>.md</code> files opened from your computer.'
    : 'Requires <b>“Allow access to file URLs”</b> in this extension’s details.';
}

async function refreshCounts() {
  const n = (await getAllowlist()).length;
  $('sites-count').textContent = String(n);
}

function showAddError(msg) {
  const e = $('add-error');
  if (!msg) { e.hidden = true; e.textContent = ''; return; }
  e.hidden = false;
  e.textContent = msg;
}

async function addSite() {
  const pattern = inputToPattern($('add-input').value);
  if (!pattern) return showAddError('Enter a domain like example.com or https://docs.example.com');
  if (pattern === 'file:///*') return showAddError('Use the Local files switch above for file:// access.');
  showAddError(null);
  let ok = false;
  try { ok = await chrome.permissions.request({ origins: [pattern] }); } catch {}
  if (!ok) return showAddError('Permission was declined.');
  await addToAllowlist(pattern);
  $('add-input').value = '';
  await refreshCounts();
  renderSites();
}

function wireSegments(settings) {
  for (const [id, key] of [['seg-theme', 'theme'], ['seg-width', 'width']]) {
    const group = $(id);
    const paint = (val) => {
      for (const b of group.children) b.setAttribute('aria-pressed', String(b.dataset.val === val));
    };
    paint(settings[key]);
    group.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      paint(b.dataset.val);
      await setSettings({ [key]: b.dataset.val });
      if (key === 'theme') applyTheme(b.dataset.val);
    });
  }
}

function wireToggles(settings) {
  const keys = ['toc', 'mermaid', 'typographer', 'linkify', 'breaks', 'softWrapCode'];
  for (const key of keys) {
    const box = $('opt-' + key);
    box.checked = !!settings[key];
    box.addEventListener('change', () => setSettings({ [key]: box.checked }));
  }
}

async function main() {
  const settings = await getSettings();
  applyTheme(settings.theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const s = await getSettings();
    if (s.theme === 'auto') applyTheme('auto');
  });

  if (new URLSearchParams(location.search).get('welcome')) $('welcome').hidden = false;

  const manifest = chrome.runtime.getManifest();
  $('version').textContent = `Markdown Viewer v${manifest.version}`;
  const repo = manifest.homepage_url;
  if (repo) $('repo-link').href = repo;
  else $('repo-link').hidden = true;

  wireSegments(settings);
  wireToggles(settings);
  await refreshCounts();
  await renderSites();

  $('add-btn').addEventListener('click', addSite);
  $('add-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addSite(); });

  $('file-toggle').addEventListener('change', async (e) => {
    const box = e.target;
    if (box.checked) {
      let ok = false;
      try { ok = await chrome.permissions.request({ origins: ['file:///*'] }); } catch {}
      if (!ok) {
        box.checked = false;
        $('file-hint').innerHTML =
          'Turn on <b>“Allow access to file URLs”</b> in this extension’s details (chrome://extensions), then try again.';
        return;
      }
      await addToAllowlist('file:///*');
    } else {
      await removeFromAllowlist('file:///*');
      try { await chrome.permissions.remove({ origins: ['file:///*'] }); } catch {}
    }
    await refreshCounts();
    renderSites();
  });
}

main();
