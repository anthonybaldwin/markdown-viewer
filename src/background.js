// background.js — service worker (ES module).
//
// Responsibilities:
//   • Register the lightweight detector content script ONLY for origins the
//     user has explicitly allowlisted (per-site opt-in, nothing runs by default).
//   • On the detector's signal, inject the full renderer into that exact frame.
//   • Inject the (large) Mermaid bundle on demand.
//   • Keep registrations in sync with the allowlist and host permissions.

import { getAllowlist, removeFromAllowlist } from './common/storage.js';

const DETECTOR_ID = 'mdv-detector';

// URLs that look like markdown files (used to scope the content-type override).
const MD_URL_REGEX =
  '\\.(md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|mdtext|rmd|qmd|ronn|workbook)([?#].*)?$';

function hostsFromAllowlist(patterns) {
  const hosts = [];
  for (const p of patterns) {
    const m = /^https?:\/\/([^/]+)\/\*$/.exec(p);
    if (m) hosts.push(m[1]);
  }
  return hosts;
}

// Some servers correctly send `Content-Type: text/markdown`, which Chrome
// downloads instead of displaying. For allowlisted hosts, rewrite the response
// content type of top-level markdown navigations to text/plain so Chrome shows
// it inline (as a <pre>) and the renderer can take over. Scoped to main_frame
// requests whose URL ends in a markdown extension, on allowlisted hosts only.
async function syncDnrRules() {
  let existing = [];
  try {
    existing = await chrome.declarativeNetRequest.getDynamicRules();
  } catch {
    return;
  }
  const removeRuleIds = existing.map((r) => r.id);

  const hosts = hostsFromAllowlist(await getAllowlist());
  const addRules = hosts.map((host, i) => ({
    id: i + 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        { header: 'content-type', operation: 'set', value: 'text/plain; charset=utf-8' },
      ],
    },
    condition: {
      requestDomains: [host],
      resourceTypes: ['main_frame'],
      regexFilter: MD_URL_REGEX,
    },
  }));

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  } catch (e) {
    console.warn('[markdown-viewer] failed to update content-type rules:', e);
  }
}

async function syncAll() {
  await Promise.all([syncRegistration(), syncDnrRules()]);
}

async function hasHostPermission(pattern) {
  try {
    return await chrome.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

// Rebuild the single registered detector content script from the allowlist,
// limited to patterns we actually hold permission for.
async function syncRegistration() {
  const patterns = await getAllowlist();
  const allowed = [];
  for (const p of patterns) {
    // file:///* permission is governed by the "Allow access to file URLs"
    // toggle; contains() reflects it. Skip patterns we can't act on.
    if (await hasHostPermission(p)) allowed.push(p);
  }

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [DETECTOR_ID] });
  } catch {
    /* nothing registered yet */
  }

  if (!allowed.length) return;

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: DETECTOR_ID,
        js: ['dist/detector.js'],
        matches: allowed,
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } catch (e) {
    console.warn('[markdown-viewer] failed to register detector:', e);
  }
}

function injectInto(sender, files) {
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return Promise.reject(new Error('no tab'));
  return chrome.scripting.executeScript({
    target: { tabId, frameIds: [sender.frameId ?? 0] },
    files,
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !sender.tab) return;

  if (msg.type === 'mdv-render') {
    injectInto(sender, ['dist/content.js']).catch((e) =>
      console.warn('[markdown-viewer] content injection failed:', e)
    );
    return; // fire and forget
  }

  if (msg.type === 'mdv-need-mermaid') {
    injectInto(sender, ['dist/mermaid.js'])
      .then(() => sendResponse({ ok: true }))
      .catch((e) => {
        console.warn('[markdown-viewer] mermaid injection failed:', e);
        sendResponse({ ok: false });
      });
    return true; // keep the channel open for the async response
  }

  if (msg.type === 'mdv-sync') {
    syncAll().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Keep registrations honest if the user revokes a host permission from the
// Chrome UI: drop it from the allowlist and re-sync.
chrome.permissions.onRemoved.addListener(async (perms) => {
  const origins = perms.origins || [];
  for (const o of origins) await removeFromAllowlist(o);
  await syncAll();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.allowlist) syncAll();
});

chrome.runtime.onStartup.addListener(syncAll);
chrome.runtime.onInstalled.addListener((details) => {
  syncAll();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html?welcome=1') });
  }
});
