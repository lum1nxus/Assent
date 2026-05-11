/**
 * Side panel UI script.
 *
 * Responsibilities:
 *   - Read analysis result from chrome.storage.session
 *   - Render the result (score ring, grade, top-3, flags, credits, alternative)
 *   - Dispatch HIGHLIGHT_QUOTE messages to the content script on user request
 *   - Show donation card when shouldShowDonation() returns true
 *
 * Everything user-facing is localized via chrome.i18n.
 */

import {
  shouldShowDonation,
  snoozeDonation,
  dismissForever,
  PAYPAL_LINK,
  PAYPAL_LINK_CHOOSE_AMOUNT,
} from "../features/donation.js";

const app = document.getElementById("app");
const domainLabel = document.getElementById("domain-label");
const headerTitle = document.getElementById("header-title");

const METHODOLOGY_URL = "https://github.com/lum1nxus/Assent#methodology";

const t = (key, fallback = "") => chrome.i18n.getMessage(key) || fallback;

document.title = t("extName", "Assent");
headerTitle.textContent = t("extName", "Assent");

// ── Render helpers ────────────────────────────────────────────────────────

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

function sourceBadge(source) {
  const label =
    source === "static_db"
      ? t("labelSourceDB", "pre-analyzed")
      : t("labelSourceAI", "on-device AI");
  return `<span class="source-badge">${esc(label)}</span>`;
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

function renderAlternative(alt) {
  if (!alt) {
    return "";
  }
  return `
    <div class="section">
      <div class="section-title">${esc(t("sectionAlternative", "Lower-risk alternative"))}</div>
      <div class="alternative-card">
        <div class="alternative-domain">${esc(alt.domain)}</div>
        <div class="alternative-score">Risk score ${Number(alt.score).toFixed(1)}/10 · Grade ${esc(alt.grade ?? "—")}</div>
      </div>
    </div>`;
}

function renderDisclaimer(disclaimer, source, analyzedAt) {
  const dateStr = analyzedAt
    ? new Date(analyzedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  return `
    <div class="disclaimer">
      <div class="disclaimer-title">${esc(t("disclaimerTitle", "About this analysis"))} ${sourceBadge(source ?? "ai")}</div>
      <div>${esc(t("disclaimerBody", ""))}</div>
      ${dateStr ? `<div style="margin-top:6px">${esc(t("labelDate", "Analyzed"))}: ${esc(dateStr)}</div>` : ""}
      <div style="margin-top:6px"><a id="methodology-link" href="#">${esc(t("btnViewMethodology", "How we score"))} ↗</a></div>
    </div>`;
}

function renderResult(state) {
  const result = state.result;
  domainLabel.textContent = result.domain ?? "—";

  app.innerHTML = `
    <div class="score-section">
      ${renderRing(result.score)}
      <div class="score-meta">
        <div class="grade-row">
          <span class="grade-badge grade-${esc(result.grade ?? "F")}">${esc(result.grade ?? "F")}</span>
          <span class="score-label" style="color:${scoreColor(result.score)}">${esc(scoreLabel(result.score))}</span>
        </div>
        <div class="score-sublabel">${esc(t("disclaimerBody", "Automated pattern detection — not legal advice."))}</div>
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
    ${renderAlternative(result.alternative)}
    ${renderDisclaimer(result.disclaimer, result.source, result.analyzedAt)}
    <div id="donation-slot"></div>
    <div class="footer">Assent · open source · not affiliated with any company</div>
  `;

  // Methodology link
  document.getElementById("methodology-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: METHODOLOGY_URL });
  });

  // Flag expand
  app.querySelectorAll(".flag-header").forEach((header) => {
    header.addEventListener("click", () => {
      document.getElementById(header.dataset.flag)?.classList.toggle("open");
    });
  });

  // Click-to-highlight dispatch
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
      } catch {
        // content script not present (probably navigated away) — ignore
      }
    });
  });

  // Auto-open first flag with a quote
  if (result.flags?.length > 0) {
    document.getElementById("flag-0")?.classList.add("open");
  }

  // Donation card (smart timing)
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
    snoozeDonation();
  });
  document.getElementById("donate-custom").addEventListener("click", () => {
    chrome.tabs.create({ url: PAYPAL_LINK_CHOOSE_AMOUNT });
    snoozeDonation();
  });
  document.getElementById("donate-later").addEventListener("click", () => {
    snoozeDonation();
    document.querySelector(".donation")?.remove();
  });
  document.getElementById("donate-never").addEventListener("click", () => {
    dismissForever();
    document.querySelector(".donation")?.remove();
  });
}

function renderLoading(domain) {
  domainLabel.textContent = domain ?? "—";
  app.innerHTML = `
    <div class="state-loading">
      <div class="spinner"></div>
      <div>${esc(t("stateLoading", "Scanning Terms of Service…"))}</div>
    </div>`;
}

function renderIdle() {
  domainLabel.textContent = "—";
  app.innerHTML = `
    <div class="state-idle">
      ${esc(t("stateIdle", "No Terms of Service detected on this page."))}
    </div>`;
}

function renderError(message, domain) {
  domainLabel.textContent = domain ?? "—";
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

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    renderIdle();
    return;
  }
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE", tabId: tab.id });
  dispatchState(tab.id, state);
}

function dispatchState(tabId, state) {
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

function pollForResult(tabId, attempts = 0) {
  if (attempts > 30) {
    renderError("Timed out.", "");
    return;
  }
  setTimeout(async () => {
    const state = await chrome.runtime.sendMessage({ type: "GET_STATE", tabId });
    if (state?.status === "done" || state?.status === "error") {
      dispatchState(tabId, state);
    } else {
      pollForResult(tabId, attempts + 1);
    }
  }, 1000);
}

// React to background updates while panel is open
chrome.storage.session.onChanged.addListener(async (changes) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }
  const key = `tab_${tab.id}`;
  if (changes[key]?.newValue) {
    dispatchState(tab.id, changes[key].newValue);
  }
});

// Clear highlights when panel closes
window.addEventListener("beforeunload", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "CLEAR_HIGHLIGHTS" }).catch(() => {});
  }
});

init();
