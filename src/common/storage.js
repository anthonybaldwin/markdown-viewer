// storage.js — shared settings + per-site allowlist persistence.
// Imported by the content bundle, the background service worker, the popup,
// and the options page so they all agree on shape and defaults.

export const DEFAULTS = Object.freeze({
  theme: 'auto', // 'light' | 'dark' | 'auto'
  width: 'comfortable', // 'comfortable' | 'full'
  toc: true, // show the table-of-contents rail
  typographer: true, // smart quotes / dashes
  linkify: true, // auto-link bare URLs
  breaks: false, // treat single newlines as <br>
  mermaid: true, // render ```mermaid diagrams
  softWrapCode: false, // wrap long lines in code blocks
});

const SETTINGS_KEY = 'settings';
const ALLOWLIST_KEY = 'allowlist';

export async function getSettings() {
  const got = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULTS, ...(got[SETTINGS_KEY] || {}) };
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

// Allowlist is an array of Chrome match patterns, e.g.
//   "https://example.com/*"  or  "file:///*"
export async function getAllowlist() {
  const got = await chrome.storage.local.get(ALLOWLIST_KEY);
  const list = got[ALLOWLIST_KEY];
  return Array.isArray(list) ? list : [];
}

export async function setAllowlist(list) {
  const unique = Array.from(new Set(list)).sort();
  await chrome.storage.local.set({ [ALLOWLIST_KEY]: unique });
  return unique;
}

export async function addToAllowlist(pattern) {
  const list = await getAllowlist();
  if (!list.includes(pattern)) list.push(pattern);
  return setAllowlist(list);
}

export async function removeFromAllowlist(pattern) {
  const list = (await getAllowlist()).filter((p) => p !== pattern);
  return setAllowlist(list);
}

export function onChanged(cb) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[SETTINGS_KEY] || changes[ALLOWLIST_KEY]) cb(changes);
  });
}

// Turn an arbitrary page URL into an origin match pattern for the allowlist.
// Returns null for URLs we can't/shouldn't match (chrome://, extension pages…).
export function urlToPattern(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol === 'file:') return 'file:///*';
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    return `${u.protocol}//${u.host}/*`;
  }
  return null;
}

export function patternLabel(pattern) {
  if (pattern === 'file:///*') return 'Local files (file://)';
  return pattern.replace(/^(https?:\/\/)/, '').replace(/\/\*$/, '');
}
