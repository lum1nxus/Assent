import {
  shouldShowDonation,
  snoozeDonation,
  declineDonation,
  recordDonationClick,
  PAYPAL_LINK,
  PAYPAL_LINK_CHOOSE_AMOUNT,
} from "../features/donation.js";

const app = document.getElementById("app");
const domainLabel = document.getElementById("domain-label");
const headerTitle = document.getElementById("header-title");
const persistentFooter = document.getElementById("persistent-footer");

const METHODOLOGY_URL = "https://github.com/lum1nxus/Assent#methodology";

const t = (key, fallback = "") => chrome.i18n.getMessage(key) || fallback;

document.title = t("extName", "Assent");
headerTitle.textContent = t("extName", "Assent");
renderPersistentFooter();

function scoreColor(score) {
  if (score <= 3.0) {
    return "var(--green)";
  }
  if (score <= 5.5) {
    return "var(--yellow)";
  }
  if (score <= 7.5) {
    return "var(--orange)";
  }
  return "var(--red)";
}

function scoreLabel(score) {
  if (score <= 3.0) {
    return t("scoreLabelLow", "Low risk");
  }
  if (score <= 5.5) {
    return t("scoreLabelMedium", "Moderate risk");
  }
  if (score <= 7.5) {
    return t("scoreLabelHigh", "High risk");
  }
  return t("scoreLabelExtreme", "Extreme risk");
}

function renderRing(score) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const fraction = Math.min(Math.max(score / 10, 0), 1);
  const offset = circ * (1 - fraction);
  const color = scoreColor(score);
  return `
    <div class="score-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle class="track" cx="32" cy="32" r="${r}" />
        <circle class="fill" cx="32" cy="32" r="${r}" stroke="${color}"
                stroke-dasharray="${circ}" stroke-dashoffset="${offset}" />
      </svg>
      <div class="score-number" style="color:${color}">${score.toFixed(1)}</div>
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
        .map(
          (c) => `
        <div class="credit-item">
          <span class="credit-check">✓</span>
          <span class="credit-title">${esc(c.title)}</span>
          ${c.note ? `<div class="credit-note">${esc(c.note)}</div>` : ""}
        </div>`,
        )
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
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const quote = btn.getAttribute("data-quote");
      if (!quote) {
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        return;
      }
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "HIGHLIGHT_QUOTE", quote });
      } catch {}
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
  `;
  document.getElementById("footer-support-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: PAYPAL_LINK_CHOOSE_AMOUNT });
  });
}

function renderLoading(domain) {
  domainLabel.textContent = domain ?? "-";
  app.innerHTML = `
    <div class="state-loading">
      <div class="spinner"></div>
      <div>${esc(t("stateLoading", "Scanning document…"))}</div>
    </div>`;
}

function renderIdle() {
  domainLabel.textContent = "-";
  app.innerHTML = `
    <div class="state-idle">
      ${esc(t("stateIdle", "No document detected on this page."))}
    </div>`;
}

function renderError(message, domain) {
  domainLabel.textContent = domain ?? "-";
  app.innerHTML = `
    <div class="state-error">
      <div class="error-label">${esc(t("stateError", "Analysis unavailable"))}</div>
      <div>${esc(message || t("errorNoDeviceAI", ""))}</div>
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
let pollHandle = null;

async function loadStateForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    currentTabId = null;
    cancelPolling();
    renderIdle();
    return;
  }
  currentTabId = tab.id;
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE", tabId: tab.id });
  dispatchState(tab.id, state);
}

function dispatchState(tabId, state) {
  if (tabId !== currentTabId) {
    return;
  }
  cancelPolling();
  switch (state?.status) {
    case "done":
      renderResult(state);
      break;
    case "loading":
      renderLoading(state.domain);
      pollForResult(tabId);
      break;
    case "error":
      renderError(state.error, state.domain);
      break;
    default:
      renderIdle();
  }
}

function cancelPolling() {
  if (pollHandle !== null) {
    clearTimeout(pollHandle);
    pollHandle = null;
  }
}

function pollForResult(tabId, attempts = 0) {
  if (attempts > 240 || tabId !== currentTabId) {
    pollHandle = null;
    return;
  }
  pollHandle = setTimeout(async () => {
    if (tabId !== currentTabId) {
      pollHandle = null;
      return;
    }
    const state = await chrome.runtime.sendMessage({ type: "GET_STATE", tabId });
    if (tabId !== currentTabId) {
      pollHandle = null;
      return;
    }
    if (state?.status === "done" || state?.status === "error") {
      dispatchState(tabId, state);
    } else {
      pollForResult(tabId, attempts + 1);
    }
  }, 1000);
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
  if (tabId === currentTabId && (changeInfo.status === "complete" || changeInfo.url)) {
    loadStateForActiveTab();
  }
});

window.addEventListener("beforeunload", () => {
  if (currentTabId !== null) {
    chrome.tabs.sendMessage(currentTabId, { type: "CLEAR_HIGHLIGHTS" }).catch(() => {});
  }
});

loadStateForActiveTab();
