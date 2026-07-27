import {
  shouldShowDonation,
  snoozeDonation,
  declineDonation,
  recordDonationClick,
  PAYPAL_LINK,
  PAYPAL_LINK_CHOOSE_AMOUNT,
} from "../features/donation.js";
import { CAP, checkCapability } from "../features/capability.js";

const app = document.getElementById("app");
const domainLabel = document.getElementById("domain-label");
const headerTitle = document.getElementById("header-title");
const persistentFooter = document.getElementById("persistent-footer");

const METHODOLOGY_URL = "https://github.com/lum1nxus/Assent#methodology";
const EXTENSION_VERSION = chrome.runtime.getManifest().version;

const t = (key, fallback = "") => chrome.i18n.getMessage(key) || fallback;

document.title = t("extName", "Assent");
headerTitle.textContent = t("extName", "Assent");
renderPersistentFooter();
wireDebugDialog();

function scoreColor(score) {
  if (score <= 8) {
    return "var(--green)";
  }
  if (score <= 22) {
    return "#d9f99d";
  }
  if (score <= 44) {
    return "var(--yellow)";
  }
  if (score <= 65) {
    return "var(--orange)";
  }
  return "var(--red)";
}

function scoreLabel(score) {
  if (score <= 8) {
    return t("scoreLabelLow", "Low risk");
  }
  if (score <= 44) {
    return t("scoreLabelMedium", "Moderate risk");
  }
  if (score <= 65) {
    return t("scoreLabelHigh", "High risk");
  }
  return t("scoreLabelExtreme", "Extreme risk");
}

function renderRing(score) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const fraction = Math.min(Math.max(Number(score) / 100, 0), 1);
  const offset = circ * (1 - fraction);
  const color = scoreColor(score);
  return `
    <div class="score-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle class="track" cx="32" cy="32" r="${r}" />
        <circle class="fill" cx="32" cy="32" r="${r}" stroke="${color}"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" />
      </svg>
      <div class="score-number" style="color:${color}">${Math.round(Number(score))}</div>
    </div>`;
}

function severityClass(sev) {
  return sev === "high" || sev === "full" ? "high" : "partial";
}

function renderHighlights(items = []) {
  if (items.length === 0) {
    return "";
  }
  return `
    <div class="section">
      <div class="section-title">${esc(t("sectionTopThree", "Top 3 things to know"))}</div>
      <ul class="top3">
        ${items
          .map((it) => `<li class="${severityClass(it.severity)}">${esc(it.title)}</li>`)
          .join("")}
      </ul>
    </div>`;
}

function renderFlag(flag, idx) {
  const id = `flag-${idx}`;
  const sevClass = severityClass(flag.severity);
  const hasQuote = typeof flag.quote === "string" && flag.quote.length > 4;
  const reason = typeof flag.verifierReason === "string" ? flag.verifierReason.trim() : "";
  return `
    <div class="flag" id="${id}">
      <div class="flag-header" data-flag="${id}">
        <div class="flag-dot ${sevClass}"></div>
        <span class="flag-title-text">${esc(flag.title)}</span>
        <span class="flag-severity-pill ${sevClass}">${esc(flag.severity)}</span>
        <span class="flag-chevron">▾</span>
      </div>
      <div class="flag-body">
        ${
          reason
            ? `<div class="flag-verifier-note">${esc(t("labelWhyFlagged", "Why this was flagged"))}: ${esc(reason)}</div>`
            : ""
        }
        ${
          hasQuote
            ? `<div class="flag-quote">
                 <div class="flag-quote-label">${esc(t("labelEvidence", "Evidence:"))}</div>
                 <blockquote>${esc(flag.quote)}</blockquote>
               </div>
               <button class="btn-show" data-quote="${escAttr(flag.quote)}">${esc(t("btnShowInDocument", "Show in document"))}</button>`
            : ""
        }
      </div>
    </div>`;
}

function renderCredits(credits = []) {
  if (credits.length === 0) {
    return "";
  }
  return `
    <div class="section">
      <div class="section-title">${esc(t("sectionCredits", "Good practices detected"))}</div>
      ${credits
        .map((c) => {
          const reason = typeof c.verifierReason === "string" ? c.verifierReason.trim() : "";
          return `
        <div class="credit-item">
          <span class="credit-check">✓</span>
          <span class="credit-title">${esc(c.title)}</span>
          ${c.note ? `<div class="credit-note">${esc(c.note)}</div>` : ""}
          ${reason ? `<div class="credit-note">${esc(reason)}</div>` : ""}
        </div>`;
        })
        .join("")}
    </div>`;
}

function renderDisclaimer(disclaimer, analyzedAt) {
  const dateStr = analyzedAt
    ? new Date(analyzedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const body = disclaimer?.text || t("disclaimerBody", "");
  return `
    <div class="disclaimer">
      <div class="disclaimer-title">${esc(t("disclaimerTitle", "About this analysis"))}</div>
      <div>${esc(body)}</div>
      ${dateStr ? `<div style="margin-top:6px">${esc(t("labelDate", "Analyzed"))}: ${esc(dateStr)}</div>` : ""}
      <div style="margin-top:6px"><a id="methodology-link" href="#">${esc(t("btnViewMethodology", "How we score"))} ↗</a></div>
    </div>`;
}

function renderConfidenceNotice(result) {
  const lowRecall = result?.stageAStats?.lowRecall === true;
  const incomplete = result?.contentMaybeIncomplete === true;
  if (!lowRecall && !incomplete) {
    return "";
  }
  const message = lowRecall
    ? t(
        "noticeLowRecall",
        "We could not find verifiable clauses in the visible page text. The actual document may be hidden behind a tab, accordion, or paywall. Try expanding each section before opening this analysis.",
      )
    : t(
        "noticeIncompleteContent",
        "Only a small slice of the page was readable. The document may be lazy-loaded - expand each section before re-running analysis.",
      );
  return `<div class="confidence-notice">${esc(message)}</div>`;
}

function renderResult(state) {
  const result = state.result;
  domainLabel.textContent = result.domain ?? "-";

  app.innerHTML = `
    <div class="score-section">
      ${renderRing(result.score)}
      <div class="score-meta">
        <div class="grade-row">
          <span class="grade-badge grade-${esc(result.grade ?? "F")}">${esc(result.grade ?? "F")}</span>
          <span class="score-label" style="color:${scoreColor(result.score)}">${esc(scoreLabel(result.score))}</span>
        </div>
        <div class="score-sublabel">${esc(t("scoreSublabel", "Pattern detection only - not legal advice."))}</div>
        <div class="score-summary">${esc(result.summary ?? "")}</div>
      </div>
    </div>

    ${renderConfidenceNotice(result)}

    ${renderHighlights(result.highlights)}

    ${
      result.flags?.length > 0
        ? `<div class="section">
             <div class="section-title">
               ${esc(t("sectionFlags", "Flagged clauses"))} (${result.flags.length})
             </div>
             ${result.flags.map((f, i) => renderFlag(f, i)).join("")}
           </div>`
        : ""
    }

    ${renderCredits(result.credits)}
    ${renderDisclaimer(result.disclaimer, result.analyzedAt)}
    <div id="donation-slot"></div>
  `;

  document.getElementById("methodology-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: METHODOLOGY_URL });
  });

  app.querySelectorAll(".flag-header").forEach((header) => {
    header.addEventListener("click", () => {
      document.getElementById(header.dataset.flag)?.classList.toggle("open");
    });
  });

  app.querySelectorAll(".btn-show").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const quote = btn.getAttribute("data-quote");
      if (!quote) {
        return;
      }
      chrome.runtime.sendMessage({ type: "HIGHLIGHT_IN_TAB", quote });
    });
  });

  if (result.flags?.length > 0) {
    document.getElementById("flag-0")?.classList.add("open");
  }

  renderDonationIfDue();
}

async function renderDonationIfDue() {
  let due = false;
  try {
    due = await shouldShowDonation();
  } catch {
    return;
  }
  if (!due) {
    return;
  }

  const slot = document.getElementById("donation-slot");
  if (!slot) {
    return;
  }
  slot.innerHTML = `
    <div class="donation">
      <div class="donation-title">${esc(t("donationTitle", ""))}</div>
      <div class="donation-body">${esc(t("donationBody", ""))}</div>
      <div class="donation-actions">
        <button class="btn-primary" id="donate-ten">${esc(t("donationBtnTen", ""))}</button>
        <button class="btn-secondary" id="donate-custom">${esc(t("donationBtnCustom", ""))}</button>
        <button class="btn-link" id="donate-later">${esc(t("donationBtnLater", ""))}</button>
        <button class="btn-link" id="donate-never">${esc(t("donationBtnNever", ""))}</button>
      </div>
    </div>`;
  document.getElementById("donate-ten").addEventListener("click", () => {
    chrome.tabs.create({ url: PAYPAL_LINK });
    recordDonationClick();
    document.querySelector(".donation")?.remove();
  });
  document.getElementById("donate-custom").addEventListener("click", () => {
    chrome.tabs.create({ url: PAYPAL_LINK_CHOOSE_AMOUNT });
    recordDonationClick();
    document.querySelector(".donation")?.remove();
  });
  document.getElementById("donate-later").addEventListener("click", () => {
    snoozeDonation();
    document.querySelector(".donation")?.remove();
  });
  document.getElementById("donate-never").addEventListener("click", () => {
    declineDonation();
    document.querySelector(".donation")?.remove();
  });
}

function renderPersistentFooter() {
  if (!persistentFooter) {
    return;
  }
  persistentFooter.innerHTML = `
    <div>${esc(t("footerAttribution", ""))}</div>
    <div class="footer-support"><a id="footer-support-link" href="#">${esc(t("footerSupport", "Support development"))}</a></div>
    <div class="footer-version-row">
      <span class="footer-version">Assent v${esc(EXTENSION_VERSION)}</span>
      <button class="btn-debug" id="footer-debug-btn" type="button">Debug</button>
    </div>
  `;
  document.getElementById("footer-support-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: PAYPAL_LINK_CHOOSE_AMOUNT });
  });
  document.getElementById("footer-debug-btn")?.addEventListener("click", openDebugDialog);
}

let lastSeenState = null;
let lastSeenUrl = null;

function captureStateForDebug(state) {
  lastSeenState = state ?? null;
  lastSeenUrl = currentTabUrl ?? null;
}

function buildDebugBundle() {
  const state = lastSeenState;
  const url = lastSeenUrl;
  const base = {
    name: buildBundleName(state),
    version: EXTENSION_VERSION,
    capturedAt: new Date().toISOString(),
    tabUrl: url,
    status: state?.status ?? "idle",
  };
  if (!state || state.status !== "done" || !state.result) {
    return {
      ...base,
      note: "no completed analysis to capture",
      error: state?.error ?? null,
    };
  }
  const r = state.result;
  const dbg = r._debug ?? {};
  return {
    ...base,
    domain: r.domain ?? null,
    analyzedAt: r.analyzedAt ?? null,
    serviceType: r.serviceType ?? null,
    score: r.score ?? null,
    grade: r.grade ?? null,
    flags: (r.flags ?? []).map((f) => ({
      category: f.category ?? f.id ?? null,
      severity: f.severity ?? null,
      quote: f.quote ?? null,
      verifierReason: f.verifierReason ?? null,
      verifierFailed: f.verifierFailed ?? false,
    })),
    credits: (r.credits ?? []).map((c) => ({
      category: c.category ?? c.id ?? null,
      quote: c.quote ?? null,
      verifierReason: c.verifierReason ?? null,
      verifierFailed: c.verifierFailed ?? false,
    })),
    extractedWords: dbg.extractedWords ?? null,
    tosLanguage: dbg.tosLanguage ?? null,
    jurisdictionContext: dbg.jurisdictionContext ?? null,
    stageAStats: r.stageAStats ?? dbg.stageAStats ?? null,
    contentMaybeIncomplete: r.contentMaybeIncomplete ?? false,
    rawAiResponse: dbg.rawAiResponse ?? "",
    verifierResponses: dbg.verifierResponses ?? {},
    documentText: dbg.documentText ?? "",
  };
}

function buildBundleName(state) {
  const domain = state?.result?.domain ?? "unknown";
  const safe = String(domain).replace(/[^a-z0-9.-]/gi, "-");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `debug-${safe}-${stamp}`;
}

function wireDebugDialog() {
  const dialog = document.getElementById("debug-dialog");
  if (!dialog) {
    return;
  }
  document.getElementById("debug-close")?.addEventListener("click", () => dialog.close());
  document.getElementById("debug-copy")?.addEventListener("click", async () => {
    const textarea = document.getElementById("debug-textarea");
    const btn = document.getElementById("debug-copy");
    if (!textarea || !btn) {
      return;
    }
    try {
      await navigator.clipboard.writeText(textarea.value);
      const prev = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = prev;
      }, 1500);
    } catch {
      textarea.select();
    }
  });
  document.getElementById("debug-download")?.addEventListener("click", () => {
    const textarea = document.getElementById("debug-textarea");
    if (!textarea) {
      return;
    }
    let bundle;
    try {
      bundle = JSON.parse(textarea.value);
    } catch {
      bundle = { name: "assent-debug" };
    }
    const blob = new Blob([textarea.value], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${bundle.name ?? "assent-debug"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      dialog.close();
    }
  });
}

function openDebugDialog() {
  const dialog = document.getElementById("debug-dialog");
  const textarea = document.getElementById("debug-textarea");
  const meta = document.getElementById("debug-meta");
  if (!dialog || !textarea || !meta) {
    return;
  }
  const bundle = buildDebugBundle();
  textarea.value = JSON.stringify(bundle, null, 2);
  const docLen = (bundle.documentText ?? "").length;
  const rawLen = (bundle.rawAiResponse ?? "").length;
  meta.textContent = `v${EXTENSION_VERSION} - status: ${bundle.status} - doc: ${docLen}b - raw: ${rawLen}b`;
  if (!dialog.open) {
    dialog.showModal();
  }
}

function renderLoading(state) {
  const domain = state?.domain ?? "-";
  const stage = state?.stage;
  const stageLabel = stage && PIPELINE_STAGE_LABELS[stage] ? PIPELINE_STAGE_LABELS[stage] : null;
  domainLabel.textContent = domain;
  app.innerHTML = `
    <div class="state-loading">
      <div class="spinner"></div>
      <div>${esc(t("stateLoading", "Scanning document…"))}</div>
      ${stageLabel ? `<div class="loading-stage">${esc(stageLabel)}</div>` : ""}
    </div>`;
}

function renderIdle() {
  domainLabel.textContent = "-";
  app.innerHTML = `
    <div class="state-idle">
      ${esc(t("stateIdle", "No analysis yet on this page."))}
      <div style="margin-top:16px">
        <button class="btn-primary" id="scan-btn">${esc(t("btnScan", "Scan this page"))}</button>
      </div>
    </div>`;
  const scanBtn = document.getElementById("scan-btn");
  scanBtn?.addEventListener("click", () => {
    startScan(scanBtn);
  });
}

async function startScan(scanBtn) {
  if (scanBtn) {
    scanBtn.disabled = true;
  }
  let cap = null;
  try {
    cap = await checkCapability();
  } catch {
    cap = null;
  }
  if (!cap || cap.state !== CAP.READY) {
    renderSetupNeeded();
    return;
  }
  renderLoading({ domain: domainFromUrl(currentTabUrl) });
  chrome.runtime.sendMessage({ type: "SCAN_ACTIVE_TAB" });
}

function renderSetupNeeded() {
  domainLabel.textContent = "-";
  app.innerHTML = `
    <div class="state-idle">
      ${esc(t("sidepanelSetupNeeded", "Assent needs a quick one-time setup before it can analyse pages."))}
      <div style="margin-top:16px">
        <button class="btn-primary" id="setup-btn">${esc(t("btnOpenSetup", "Open setup"))}</button>
      </div>
    </div>`;
  document.getElementById("setup-btn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  });
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "-";
  }
}

function renderError(message, domain) {
  domainLabel.textContent = domain ?? "-";
  app.innerHTML = `
    <div class="state-error">
      <div class="error-label">${esc(t("stateError", "Analysis unavailable"))}</div>
      <div>${esc(message || t("errorNoDeviceAI", ""))}</div>
    </div>`;
}

function renderUnsupportedLanguage(domain) {
  domainLabel.textContent = domain ?? "-";
  app.innerHTML = `
    <div class="state-unsupported">
      <div class="unsupported-label">${esc(t("stateUnsupportedLanguage", "English-only for now"))}</div>
      <div>${esc(t("stateUnsupportedLanguageBody", ""))}</div>
    </div>`;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(s) {
  return esc(s).replace(/'/g, "&#39;");
}

let currentTabId = null;
let currentTabUrl = null;
let stuckLoadingTimer = null;
const lastDoneStatePerTab = new Map();
const MAX_CACHED_TABS = 32;
const STUCK_LOADING_TIMEOUT_MS = 5 * 60 * 1000;

function cacheDoneState(tabId, state) {
  if (lastDoneStatePerTab.has(tabId)) {
    lastDoneStatePerTab.delete(tabId);
  } else if (lastDoneStatePerTab.size >= MAX_CACHED_TABS) {
    const oldest = lastDoneStatePerTab.keys().next().value;
    if (oldest !== undefined) {
      lastDoneStatePerTab.delete(oldest);
    }
  }
  lastDoneStatePerTab.set(tabId, state);
}

const PIPELINE_STAGE_LABELS = {
  "detect-lang": "Detecting language",
  extract: "Reading document",
  "extract-jurisdiction": "Reading jurisdiction",
  analyze: "Classifying clauses",
  verify: "Verifying findings",
  persist: "Finalising",
};

function materialUrlEquals(a, b) {
  if (!a || !b) {
    return a === b;
  }
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.origin === ub.origin && ua.pathname === ub.pathname;
  } catch {
    return a === b;
  }
}

async function loadStateForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    currentTabId = null;
    currentTabUrl = null;
    clearStuckLoadingTimer();
    renderIdle();
    return;
  }
  currentTabId = tab.id;
  currentTabUrl = tab.url ?? null;
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE", tabId: tab.id });
  dispatchState(tab.id, state);
}

function dispatchState(tabId, state) {
  if (tabId !== currentTabId) {
    return;
  }

  const incomingStatus = state?.status ?? "idle";

  if (incomingStatus === "idle" && lastDoneStatePerTab.has(tabId)) {
    const cached = lastDoneStatePerTab.get(tabId);
    clearStuckLoadingTimer();
    captureStateForDebug(cached);
    renderResult(cached);
    return;
  }

  if (incomingStatus !== "loading") {
    clearStuckLoadingTimer();
  }

  switch (incomingStatus) {
    case "done":
      cacheDoneState(tabId, state);
      captureStateForDebug(state);
      renderResult(state);
      break;
    case "loading":
      captureStateForDebug(state);
      renderLoading(state);
      armStuckLoadingTimer(tabId);
      break;
    case "error":
      captureStateForDebug(state);
      renderError(state.error, state.domain);
      break;
    case "unsupported_language":
      captureStateForDebug(state);
      renderUnsupportedLanguage(state.domain);
      break;
    default:
      captureStateForDebug(state);
      renderIdle();
  }
}

function clearStuckLoadingTimer() {
  if (stuckLoadingTimer !== null) {
    clearTimeout(stuckLoadingTimer);
    stuckLoadingTimer = null;
  }
}

function armStuckLoadingTimer(tabId) {
  clearStuckLoadingTimer();
  stuckLoadingTimer = setTimeout(() => {
    if (tabId !== currentTabId) {
      return;
    }
    renderError(t("errorStuck", "Analysis is taking too long. Please reload the page."), null);
  }, STUCK_LOADING_TIMEOUT_MS);
}

chrome.storage.session.onChanged.addListener((changes) => {
  if (currentTabId === null) {
    return;
  }
  const key = `tab_${currentTabId}`;
  if (changes[key]?.newValue) {
    dispatchState(currentTabId, changes[key].newValue);
  }
});

chrome.tabs.onActivated.addListener(() => {
  loadStateForActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== currentTabId) {
    return;
  }
  if (changeInfo.url && !materialUrlEquals(changeInfo.url, currentTabUrl)) {
    lastDoneStatePerTab.delete(tabId);
    currentTabUrl = changeInfo.url;
    loadStateForActiveTab();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  lastDoneStatePerTab.delete(tabId);
});

window.addEventListener("beforeunload", () => {
  if (currentTabId !== null) {
    chrome.tabs.sendMessage(currentTabId, { type: "CLEAR_HIGHLIGHTS" }).catch(() => {});
  }
});

loadStateForActiveTab();
