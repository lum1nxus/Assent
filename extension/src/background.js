import { run } from "./pipeline/index.js";
import { buildContext } from "./pipeline/context.js";
import {
  extract,
  detectLang,
  extractJurisdiction,
  analyze,
  verify,
  persist,
} from "./pipeline/steps/index.js";
import { incrementAnalysisCount } from "./features/donation.js";
import { sanitizeUrl } from "./shared/url-safety.js";

const MAX_TOS_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain", "application/xhtml+xml"];

const TAB_KEY = (tabId) => `tab_${tabId}`;
const inFlight = new Set();

const PIPELINE = [
  { name: "detect-lang", fn: detectLang },
  { name: "extract", fn: extract },
  { name: "extract-jurisdiction", fn: extractJurisdiction },
  { name: "analyze", fn: analyze },
  { name: "verify", fn: verify },
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
  if (
    payload.contentMaybeIncomplete !== undefined &&
    typeof payload.contentMaybeIncomplete !== "boolean"
  ) {
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
  if (inFlight.has(tabId)) {
    return;
  }
  inFlight.add(tabId);

  const existing = await chrome.storage.session.get(TAB_KEY(tabId));
  const status = existing[TAB_KEY(tabId)]?.status;
  if (status === "done" || status === "loading") {
    inFlight.delete(tabId);
    return;
  }

  const domain = normalizeDomain(payload.domain ?? "");
  const tosUrl = sanitizeUrl(payload.tosUrl);
  if (!tosUrl) {
    inFlight.delete(tabId);
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

    const onProgress = (stage) => {
      chrome.storage.session
        .set({ [TAB_KEY(tabId)]: { status: "loading", domain, stage } })
        .catch(() => {});
    };
    const ctx = await buildContext({ tabId, onProgress });
    const result = await run(
      PIPELINE,
      { tosUrl, domain, tosText, contentMaybeIncomplete: !!payload.contentMaybeIncomplete },
      ctx,
    );

    if (result?.unsupportedLanguage) {
      await chrome.storage.session.set({
        [TAB_KEY(tabId)]: {
          status: "unsupported_language",
          domain,
          tosLanguage: result.tosLanguage ?? null,
        },
      });
      updateBadge(tabId, "unsupported");
      sendOverlay(tabId, { kind: "unsupported" });
      return;
    }

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
    inFlight.delete(tabId);
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

async function fetchTosText(url) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const safe = sanitizeUrl(current);
    if (!safe) {
      throw new Error("Refusing to fetch: URL failed sanitisation");
    }
    const res = await fetch(safe, {
      headers: { Accept: "text/html, text/plain" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "manual",
      cache: "no-store",
    });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("Location");
      if (!next) {
        throw new Error(`Redirect without Location header (HTTP ${res.status})`);
      }
      current = new URL(next, safe).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch document: HTTP ${res.status}`);
    }

    const contentType = (res.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
    if (contentType && !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new Error(`Refusing to fetch: unsupported content type "${contentType}"`);
    }

    const declared = Number(res.headers.get("Content-Length"));
    if (Number.isFinite(declared) && declared > MAX_TOS_BYTES) {
      throw new Error(`Refusing to fetch: content length ${declared} exceeds cap`);
    }

    const html = await readWithByteCap(res, MAX_TOS_BYTES);
    return stripHtml(html);
  }
  throw new Error("Too many redirects while fetching document");
}

async function readWithByteCap(res, cap) {
  if (!res.body || typeof res.body.getReader !== "function") {
    const text = await res.text();
    if (text.length > cap * 4) {
      throw new Error(`Document exceeds cap of ${cap} bytes`);
    }
    return text;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > cap) {
      try {
        await reader.cancel();
      } catch {}
      throw new Error(`Document exceeds cap of ${cap} bytes`);
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
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
    unsupported: { text: "EN", color: "#71717a" },
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
