// detector-entry.js — the only thing that runs on every allowed page. It's
// deliberately tiny: decide if this is raw markdown and, if so, ask the
// background worker to inject the (much larger) renderer. This keeps the heavy
// bundle off non-markdown pages of an allowlisted site.

import { isMarkdownCandidate } from './detect.js';

if (!window.__mdvDetected && isMarkdownCandidate()) {
  window.__mdvDetected = true;
  try {
    chrome.runtime.sendMessage({ type: 'mdv-render' });
  } catch {
    /* background not reachable; nothing to do */
  }
}
