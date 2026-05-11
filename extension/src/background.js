/**
 * Background service worker — Assent orchestrator.
 *
 * Pipeline:
 *   static-db → extract → detect-lang → translate-in → analyze → translate-out → persist
 *
 * `static-db` short-circuits on a hit. AI steps only run for unknown services.
 *
 * State is kept exclusively in `chrome.storage.session` (NOT in-memory) so it
 * survives MV3 service worker restarts (closes audit finding #1).
 */

import { run } from "./pipeline/index.js";
import { buildContext } from "./pipeline/context.js";
import {
  staticDb,
  extract,
  detectLang,
  translateIn,
  analyze,
  translateOut,
  persist,
} from "./pipeline/steps/index.js";
import { incrementAnalysisCount } from "./features/donation.js";
import { normalizeDomain } from "./pipeline/steps/static-db.js";

const TAB_KEY = (tabId) => `tab_${tabId}`;

const PIPELINE = [
  { name: "static-db", fn: staticDb },
  { name: "extract", fn: extract },
  { name: "detect-lang", fn: detectLang },
  { name: "translate-in", fn: translateIn },
  { name: "analyze", fn: analyze },
  { name: "translate-out", fn: translateOut },
  { name: "persist", fn: persist },
];

// ── Message routing ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "TOS_DETECTED") {
    handleTosDetected(sender.tab?.id, message.payload).catch((err) => {
      // eslint-disable-next-line no-console -- intentional service-worker diagnostics
      console.error("[Assent] TOS_DETECTED handler failed:", err);
    });
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "GET_STATE") {
    chrome.storage.session.get(TAB_KEY(message.tabId)).then((stored) => {
      sendResponse(stored[TAB_KEY(message.tabId)] ?? { status: "idle" });
    });
    return true;
  }
  return false;
});

// ── Tab lifecycle ─────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(TAB_KEY(tabId)).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.storage.session.remove(TAB_KEY(tabId)).catch(() => {});
    updateBadge(tabId, "idle");
  }
});

// ── Side panel wiring ─────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});

// ── Core handler ──────────────────────────────────────────────────────────

async function handleTosDetected(tabId, payload) {
  if (typeof tabId !== "number") {
    return;
  }

  // Idempotency guard via session storage — works across service worker restarts.
  const existing = await chrome.storage.session.get(TAB_KEY(tabId));
  if (
    existing[TAB_KEY(tabId)]?.status === "done" ||
    existing[TAB_KEY(tabId)]?.status === "loading"
  ) {
    return;
  }

  const domain = normalizeDomain(payload.domain ?? "");
  const tosUrl = sanitizeTosUrl(payload.tosUrl);
  if (!tosUrl) {
    return;
  }

  await chrome.storage.session.set({
    [TAB_KEY(tabId)]: { status: "loading", domain },
  });
  updateBadge(tabId, "loading");

  try {
    const tosText =
      payload.tosText && payload.tosText.length > 200
        ? payload.tosText
        : await fetchTosText(tosUrl);

    const ctx = buildContext({ tabId });
    const result = await run(PIPELINE, { tosUrl, domain, tosText }, ctx);

    updateBadge(tabId, "done", result.score);
    incrementAnalysisCount().catch(() => {});
  } catch (err) {
    // eslint-disable-next-line no-console -- intentional service-worker diagnostics
    console.error("[Assent] pipeline error:", err);
    await chrome.storage.session.set({
      [TAB_KEY(tabId)]: {
        status: "error",
        domain,
        error: "Analysis unavailable — Chrome built-in AI is not ready on this device.",
      },
    });
    updateBadge(tabId, "error");
  }
}

// ── URL safety (closes audit finding #3: SSRF) ────────────────────────────

/**
 * Validate that the supplied ToS URL is safe to fetch.
 *
 * Whitelist:
 *  - http(s) only — no file://, javascript:, data:, chrome:// etc.
 *  - Hostname must NOT resolve to a private/loopback address (rough check
 *    by IP literal pattern; full DNS pinning is out of scope for the MVP).
 *
 * Returns the canonical URL string or null if the URL is unsafe.
 */
function sanitizeTosUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
      host === "::1" ||
      host === "[::1]"
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchTosText(url) {
  const res = await fetch(url, {
    headers: { Accept: "text/html" },
    credentials: "omit",
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ToS: HTTP ${res.status}`);
  }
  const html = await res.text();
  return stripHtml(html);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Action badge ──────────────────────────────────────────────────────────

function updateBadge(tabId, status, score) {
  const badges = {
    idle: { text: "", color: "#71717a" },
    loading: { text: "...", color: "#f59e0b" },
    error: { text: "!", color: "#ef4444" },
    done: {
      text: score !== null && score !== undefined ? String(Math.round(score)) : "?",
      color: score <= 3 ? "#22c55e" : score <= 6.5 ? "#f59e0b" : "#ef4444",
    },
  };
  const badge = badges[status] ?? badges.idle;
  chrome.action.setBadgeText({ tabId, text: badge.text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color }).catch(() => {});
}
