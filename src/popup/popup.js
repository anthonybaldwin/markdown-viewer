import {
  getSettings,
  getAllowlist,
  addToAllowlist,
  removeFromAllowlist,
  urlToPattern,
  patternLabel,
} from '../common/storage.js';

const $ = (id) => document.getElementById(id);

async function applyTheme() {
  const { theme } = await getSettings();
  const dark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setNote(html) {
  const note = $('site-note');
  if (!html) {
    note.hidden = true;
    note.replaceChildren();
    return;
  }
  note.hidden = false;
  note.replaceChildren(...html);
}

function textFrag(...nodes) {
  return nodes.map((n) => (typeof n === 'string' ? document.createTextNode(n) : n));
}

async function refreshCount() {
  const list = await getAllowlist();
  const n = list.length;
  $('count').textContent =
    n === 0 ? 'No sites enabled yet' : `${n} site${n === 1 ? '' : 's'} enabled`;
}

async function main() {
  await applyTheme();
  $('open-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });

  const tab = await getActiveTab();
  const toggle = $('site-toggle');
  const hostEl = $('site-host');
  const kindEl = $('site-kind');
  const pattern = tab ? urlToPattern(tab.url || '') : null;

  await refreshCount();

  if (!pattern) {
    hostEl.textContent = 'Not available here';
    kindEl.textContent = 'Unsupported page';
    toggle.disabled = true;
    $('site-card').classList.add('disabled-context');
    setNote(
      textFrag('Markdown Viewer can run on websites and local files, but not on browser pages like this one.')
    );
    return;
  }

  const isFile = pattern === 'file:///*';
  hostEl.textContent = patternLabel(pattern);
  kindEl.textContent = isFile ? 'Local files' : 'This site';

  const list = await getAllowlist();
  const granted = await chrome.permissions.contains({ origins: [pattern] });
  const enabled = list.includes(pattern) && granted;
  toggle.checked = enabled;

  if (isFile && !granted) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Open extension settings';
    btn.addEventListener('click', () => {
      chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
      window.close();
    });
    setNote(
      textFrag(
        'To render ',
        Object.assign(document.createElement('b'), { textContent: 'file://' }),
        ' documents, turn on ',
        Object.assign(document.createElement('b'), { textContent: '“Allow access to file URLs”' }),
        ' for this extension, then flip this switch.',
        document.createElement('br'),
        btn
      )
    );
  }

  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      let ok = granted;
      if (!ok) {
        try {
          ok = await chrome.permissions.request({ origins: [pattern] });
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        toggle.checked = false;
        if (isFile) {
          setNote(
            textFrag(
              'Couldn’t get file access automatically. Enable ',
              Object.assign(document.createElement('b'), { textContent: '“Allow access to file URLs”' }),
              ' in this extension’s settings first.'
            )
          );
        } else {
          setNote(textFrag('Permission was declined, so the site wasn’t enabled.'));
        }
        return;
      }
      await addToAllowlist(pattern);
      setNote(null);
      await refreshCount();
      if (tab && tab.id != null) chrome.tabs.reload(tab.id);
    } else {
      await removeFromAllowlist(pattern);
      try {
        if (!isFile) await chrome.permissions.remove({ origins: [pattern] });
      } catch {}
      await refreshCount();
      if (tab && tab.id != null) chrome.tabs.reload(tab.id);
    }
  });
}

main();
