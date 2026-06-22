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
    syncRegistration().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Keep registrations honest if the user revokes a host permission from the
// Chrome UI: drop it from the allowlist and re-sync.
chrome.permissions.onRemoved.addListener(async (perms) => {
  const origins = perms.origins || [];
  for (const o of origins) await removeFromAllowlist(o);
  await syncRegistration();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.allowlist) syncRegistration();
});

chrome.runtime.onStartup.addListener(syncRegistration);
chrome.runtime.onInstalled.addListener((details) => {
  syncRegistration();
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html?welcome=1') });
  }
});
