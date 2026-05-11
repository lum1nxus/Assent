import { run } from "./pipeline/index.js";
import { buildContext } from "./pipeline/context.js";
import {
  extract,
  detectLang,
  translateIn,
  extractJurisdiction,
  analyze,
  translateOut,
  persist,
} from "./pipeline/steps/index.js";
import { incrementAnalysisCount } from "./features/donation.js";

const TAB_KEY = (tabId) => `tab_${tabId}`;

const PIPELINE = [
  { name: "extract", fn: extract },
  { name: "detect-lang", fn: detectLang },
  { name: "translate-in", fn: translateIn },
  { name: "extract-jurisdiction", fn: extractJurisdiction },
  { name: "analyze", fn: analyze },
  { name: "translate-out", fn: translateOut },
  { name: "persist", fn: persist },
];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    return false;
  }

  if (message?.type === "TOS_DETECTED") {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number" || !isValidTosPayload(message.payload)) {
      sendResponse({ ok: false, error: "invalid_payload" });
      return true;
    }
    handleTosDetected(tabId, message.payload).catch((err) => {
      console.error("[Assent]", err);
    });
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "GET_STATE") {
    if (!Number.isInteger(message.tabId)) {
      sendResponse({ status: "idle" });
      return true;
    }
    chrome.storage.session.get(TAB_KEY(message.tabId)).then((stored) => {
      sendResponse(stored[TAB_KEY(message.tabId)] ?? { status: "idle" });
    });
    return true;
  }
  if (message?.type === "OPEN_SIDE_PANEL") {
    const tabId = sender.tab?.id;
    if (typeof tabId === "number") {
      chrome.sidePanel.open({ tabId }).catch(() => {});
    }
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "DUMP_STATE") {
    chrome.storage.session.get(null).then((all) => sendResponse(all));
    return true;
  }
  return false;
});

function isTrustedSender(sender) {
  if (!sender) {
    return false;
  }
  if (sender.id && sender.id !== chrome.runtime.id) {
    return false;
  }
  return true;
}

function isValidTosPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  if (typeof payload.tosUrl !== "string" || payload.tosUrl.length === 0) {
    return false;
  }
  if (payload.tosText !== undefined && typeof payload.tosText !== "string") {
    return false;
  }
  if (payload.domain !== undefined && typeof payload.domain !== "string") {
    return false;
  }
  return true;
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(TAB_KEY(tabId)).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    chrome.storage.session.remove(TAB_KEY(tabId)).catch(() => {});
    updateBadge(tabId, "idle");
    sendOverlay(tabId, { kind: "hide" });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
});

async function handleTosDetected(tabId, payload) {
  if (typeof tabId !== "number") {
    return;
  }

  const existing = await chrome.storage.session.get(TAB_KEY(tabId));
  const status = existing[TAB_KEY(tabId)]?.status;
  if (status === "done" || status === "loading") {
    return;
  }

  const domain = normalizeDomain(payload.domain ?? "");
  const tosUrl = sanitizeUrl(payload.tosUrl);
  if (!tosUrl) {
    return;
  }

  await chrome.storage.session.set({
    [TAB_KEY(tabId)]: { status: "loading", domain },
  });
  updateBadge(tabId, "loading");
  sendOverlay(tabId, { kind: "loading" });

  const keepAlive = startKeepAlive();
  try {
    const tosText =
      payload.tosText && payload.tosText.length > 200
        ? payload.tosText
        : await fetchTosText(tosUrl);

    const ctx = await buildContext({ tabId });
    const result = await run(PIPELINE, { tosUrl, domain, tosText }, ctx);

    updateBadge(tabId, "done", result.score);
    sendOverlay(tabId, { kind: "done", grade: result.grade ?? "F", score: result.score });
    incrementAnalysisCount().catch(() => {});
  } catch (err) {
    console.error("[Assent]", err);
    await chrome.storage.session.set({
      [TAB_KEY(tabId)]: {
        status: "error",
        domain,
        error: err?.message || "On-device language model is not ready on this device.",
      },
    });
    updateBadge(tabId, "error");
    sendOverlay(tabId, { kind: "error" });
  } finally {
    stopKeepAlive(keepAlive);
  }
}

function startKeepAlive() {
  return setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      void chrome.runtime.lastError;
    });
  }, 25_000);
}

function stopKeepAlive(handle) {
  if (handle) {
    clearInterval(handle);
  }
}

function sendOverlay(tabId, state) {
  chrome.tabs.sendMessage(tabId, { type: "OVERLAY_UPDATE", state }).catch(() => {});
}

function normalizeDomain(raw) {
  try {
    const url = String(raw).startsWith("http") ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return String(raw)
      .toLowerCase()
      .replace(/^www\./, "");
  }
}

function sanitizeUrl(rawUrl) {
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
    throw new Error(`Failed to fetch document: HTTP ${res.status}`);
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

function updateBadge(tabId, status, score) {
  const numeric = Number(score);
  const safe = Number.isFinite(numeric) ? numeric : null;
  const badges = {
    idle: { text: "", color: "#71717a" },
    loading: { text: "...", color: "#f59e0b" },
    error: { text: "!", color: "#ef4444" },
    done: {
      text: safe !== null ? String(Math.round(safe)) : "?",
      color:
        safe === null ? "#71717a" : safe <= 22 ? "#22c55e" : safe <= 65 ? "#f59e0b" : "#ef4444",
    },
  };
  const badge = badges[status] ?? badges.idle;
  chrome.action.setBadgeText({ tabId, text: badge.text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color }).catch(() => {});
}
