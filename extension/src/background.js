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
import { CAP, checkCapability } from "./features/capability.js";
import { setupNudge } from "./features/nudge.js";

const CONTENT_SCRIPT = "src/content.js";
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

  if (message?.type === "SCAN_ACTIVE_TAB") {
    handleScanRequest().catch((err) => {
      console.error("[Assent]", err);
    });
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "HIGHLIGHT_IN_TAB" && typeof message.quote === "string") {
    highlightInActiveTab(message.quote).catch(() => {});
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

// Open the side panel from action.onClicked (NOT setPanelBehavior). This is the
// only way the click counts as an extension invocation, which grants activeTab
// for the current tab. That grant persists until the tab navigates, so the
// in-panel "Scan this page" button can then use chrome.scripting on that tab.
// setPanelBehavior({ openPanelOnActionClick: true }) would open the panel
// WITHOUT granting activeTab, and scanning would silently fail.
// setPanelBehavior is persisted in the profile. A previous build set
// openPanelOnActionClick:true, which makes the icon open the panel WITHOUT
// firing action.onClicked (so activeTab is never granted). Explicitly force it
// back to false so onClicked fires and we can grant activeTab ourselves.
chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab?.id === "number") {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  setupNudge();
  if (details?.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") }).catch(() => {});
  }
});

chrome.runtime.onStartup?.addListener(() => {
  setupNudge();
});

const NO_ACCESS_MESSAGE =
  "Assent could not access this page. Click the Assent icon on the toolbar, then press Scan this page.";

async function handleScanRequest() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (typeof tabId !== "number") {
    return;
  }

  // Only reject pages we can never script when the URL is actually readable.
  // When activeTab has not been granted yet, tab.url is undefined; in that case
  // we still try to inject and surface a clear error if the grant is missing,
  // instead of leaving the side panel spinning forever.
  if (typeof tab.url === "string" && !/^https?:/i.test(tab.url)) {
    await failScan(
      tabId,
      "errorUnsupportedPage",
      "This page can't be scanned. Open a normal web page and try again.",
    );
    return;
  }

  const cap = await checkCapability();
  if (cap.state !== CAP.READY) {
    await chrome.storage.session.remove(TAB_KEY(tabId)).catch(() => {});
    updateBadge(tabId, "idle");
    await chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") }).catch(() => {});
    return;
  }

  try {
    await ensureInjected(tabId);
  } catch {
    await failScan(tabId, "errorNoAccess", NO_ACCESS_MESSAGE);
    return;
  }

  let payload;
  try {
    payload = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_TOS" });
  } catch {
    await failScan(tabId, "errorNoAccess", NO_ACCESS_MESSAGE);
    return;
  }
  if (!payload || payload.error || !isValidTosPayload(payload)) {
    await failScan(tabId, "errorNoDocument", "No agreement text was found on this page.");
    return;
  }

  await handleTosDetected(tabId, payload);
}

async function failScan(tabId, messageKey, fallback) {
  const message = i18nMessage(messageKey, fallback);
  await chrome.storage.session
    .set({ [TAB_KEY(tabId)]: { status: "error", error: message } })
    .catch(() => {});
  updateBadge(tabId, "error");
}

function i18nMessage(key, fallback) {
  try {
    return chrome.i18n.getMessage(key) || fallback;
  } catch {
    return fallback;
  }
}

async function ensureInjected(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (pong?.ok) {
      return;
    }
  } catch {
    // Not injected yet.
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
}

async function highlightInActiveTab(quote) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }
  try {
    await ensureInjected(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "HIGHLIGHT_QUOTE", quote });
  } catch {
    // Tab may have navigated; ignore.
  }
}

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
  if (status === "loading") {
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
