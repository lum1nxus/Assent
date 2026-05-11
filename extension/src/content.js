/**
 * Content script — three responsibilities:
 *
 *   1. Detect when the current page IS a ToS document (mode A) and forward
 *      the page text to the background worker.
 *   2. Detect when the current page links to a ToS in a consent context
 *      (signup/registration) (mode B) and forward the link URL.
 *   3. Receive HIGHLIGHT_QUOTE / CLEAR_HIGHLIGHTS messages from the side
 *      panel and apply visual highlighting + scroll-into-view to the
 *      original DOM so the user can verify the flagged passage.
 */

// ── ToS detection patterns ────────────────────────────────────────────────

const TOS_URL_PATTERNS = [
  /\/(terms|tos|terms-of-service|terms-of-use|terms-and-conditions|user-agreement|end-user-agreement|legal|eula|privacy|privacy-policy|datenschutz|nutzungsbedingungen|conditions-generales|condizioni-uso|regulamin|gebruiksvoorwaarden)(\/|$|\?)/i,
];

const TOS_HEADING_PATTERNS = [
  /terms\s+of\s+(service|use)/i,
  /user\s+agreement/i,
  /end[\s-]user\s+(license\s+)?agreement/i,
  /terms\s+and\s+conditions/i,
  /privacy\s+policy/i,
  /legal\s+(terms|notice|agreement)/i,
  /\btos\b/i,
  /\beula\b/i,
  /allgemeine\s+geschäftsbedingungen/i,
  /conditions\s+(générales|d'utilisation)/i,
  /condizioni\s+d'?uso/i,
  /regulamin/i,
];

const TOS_LINK_PATTERNS = [
  /terms\s*of\s*(service|use)/i,
  /privacy\s*policy/i,
  /terms\s*and\s*conditions/i,
  /user\s*agreement/i,
  /end\s*user\s*(license|agreement)/i,
  /legal\s*notice/i,
  /\beula\b/i,
  /\btos\b/i,
];

const CONSENT_PATTERNS = [
  /i\s*agree/i,
  /accept\s*(all|terms)?/i,
  /sign\s*up/i,
  /create\s*(an?\s*)?account/i,
  /register/i,
  /get\s*started/i,
  /einverstanden/i,
  /j'accepte/i,
  /accetto/i,
  /zgadzam\s*się/i,
  /akkoord/i,
];

const MIN_TOS_TEXT_LENGTH = 500;

let reported = false;
let highlightStyleInjected = false;

// ── Mode A: current page is the ToS document ─────────────────────────────

function isToSPage() {
  const path = location.pathname + location.search;
  if (TOS_URL_PATTERNS.some((p) => p.test(path))) {
    return true;
  }
  const heading = document.querySelector("h1")?.textContent?.trim() || document.title || "";
  return TOS_HEADING_PATTERNS.some((p) => p.test(heading));
}

function extractPageText() {
  const clone = document.body.cloneNode(true);
  for (const el of clone.querySelectorAll(
    "nav, header, footer, script, style, [role='navigation'], aside",
  )) {
    el.remove();
  }
  return clone.innerText?.replace(/\s{2,}/g, " ").trim() ?? "";
}

// ── Mode B: signup page with a link to ToS ───────────────────────────────

function findTosLink() {
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  return anchors.find((a) => {
    const text = (a.textContent || "").trim();
    const href = a.getAttribute("href") || "";
    return TOS_LINK_PATTERNS.some((p) => p.test(text) || p.test(href));
  });
}

function hasConsentContext() {
  const bodyText = document.body?.innerText || "";
  return CONSENT_PATTERNS.some((p) => p.test(bodyText));
}

function absoluteUrl(href) {
  try {
    return new URL(href, location.href).href;
  } catch {
    return null;
  }
}

// ── Main detection ────────────────────────────────────────────────────────

function detect() {
  if (reported) {
    return;
  }

  if (isToSPage()) {
    const text = extractPageText();
    if (text.length >= MIN_TOS_TEXT_LENGTH) {
      reported = true;
      chrome.runtime.sendMessage({
        type: "TOS_DETECTED",
        payload: {
          tosUrl: location.href,
          domain: location.hostname,
          tosText: text,
        },
      });
      return;
    }
  }

  const tosLink = findTosLink();
  if (!tosLink) {
    return;
  }
  if (!hasConsentContext()) {
    return;
  }

  const url = absoluteUrl(tosLink.getAttribute("href"));
  if (!url) {
    return;
  }

  reported = true;
  chrome.runtime.sendMessage({
    type: "TOS_DETECTED",
    payload: {
      tosUrl: url,
      domain: location.hostname,
    },
  });
}

// ── Highlight in document (closes UX request: click-to-show-quote) ───────

function ensureHighlightStyle() {
  if (highlightStyleInjected) {
    return;
  }
  const style = document.createElement("style");
  style.setAttribute("data-assent", "highlight-style");
  style.textContent = `
    mark.assent-hl {
      background: #fff3cd !important;
      color: inherit !important;
      outline: 2px solid #f0a500;
      border-radius: 2px;
      padding: 0 2px;
      animation: assent-pulse 1.5s ease 2;
    }
    @keyframes assent-pulse {
      0%, 100% { background: #fff3cd; }
      50%      { background: #ffe082; }
    }
  `;
  document.head.appendChild(style);
  highlightStyleInjected = true;
}

function clearHighlights() {
  document.querySelectorAll("mark.assent-hl").forEach((m) => {
    const parent = m.parentNode;
    while (m.firstChild) {
      parent.insertBefore(m.firstChild, m);
    }
    parent.removeChild(m);
    parent.normalize();
  });
}

/**
 * Walk all text nodes and wrap the first occurrence of `needle` (case-insensitive,
 * fuzzy on whitespace) inside a <mark> element. Returns the wrapping element, or
 * null if nothing matched.
 */
function highlightText(quote) {
  ensureHighlightStyle();
  const needle = String(quote).replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 8) {
    return null;
  }
  const probe = needle.slice(0, Math.min(needle.length, 80));

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentNode;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }
      const tag = parent.nodeName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest("mark.assent-hl")) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue && node.nodeValue.length > 8
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  let node;
  while ((node = walker.nextNode())) {
    const hay = node.nodeValue.replace(/\s+/g, " ").toLowerCase();
    const idx = hay.indexOf(probe);
    if (idx === -1) {
      continue;
    }

    const range = document.createRange();
    const start = mapNormalizedOffsetToRaw(node.nodeValue, idx);
    const end = mapNormalizedOffsetToRaw(node.nodeValue, idx + probe.length);
    range.setStart(node, Math.max(0, start));
    range.setEnd(node, Math.min(node.nodeValue.length, end));

    const mark = document.createElement("mark");
    mark.className = "assent-hl";
    try {
      range.surroundContents(mark);
      return mark;
    } catch {
      return null;
    }
  }
  return null;
}

function mapNormalizedOffsetToRaw(rawText, normalizedOffset) {
  let raw = 0;
  let norm = 0;
  let inSpaceRun = false;
  while (raw < rawText.length && norm < normalizedOffset) {
    const ch = rawText[raw];
    if (/\s/.test(ch)) {
      if (!inSpaceRun) {
        norm++;
        inSpaceRun = true;
      }
    } else {
      norm++;
      inSpaceRun = false;
    }
    raw++;
  }
  return raw;
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "HIGHLIGHT_QUOTE" && typeof msg.quote === "string") {
    clearHighlights();
    const mark = highlightText(msg.quote);
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } else if (msg?.type === "CLEAR_HIGHLIGHTS") {
    clearHighlights();
  }
});

// ── Early-exit + observer (closes audit finding #2: wasteful CPU) ────────

function quickReject() {
  // If we're definitely not on a ToS page and definitely not on a signup page,
  // skip the MutationObserver entirely.
  if (isToSPage()) {
    return false;
  }
  const bodyText = document.body?.innerText || "";
  if (!CONSENT_PATTERNS.some((p) => p.test(bodyText))) {
    return true;
  }
  return false;
}

detect();

if (!reported && !quickReject()) {
  const observer = new MutationObserver(() => {
    if (!reported) {
      detect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 8_000);
}
