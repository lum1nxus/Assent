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
    "nav, header, footer, script, style, noscript, iframe, form, template, [role='navigation'], aside",
  )) {
    el.remove();
  }
  for (const details of clone.querySelectorAll("details")) {
    details.setAttribute("open", "");
  }
  for (const hidden of clone.querySelectorAll("[hidden]")) {
    hidden.removeAttribute("hidden");
  }
  for (const ariaHidden of clone.querySelectorAll("[aria-hidden='true']")) {
    ariaHidden.removeAttribute("aria-hidden");
  }
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

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

const HIGHLIGHT_NAME = "assent-hl";

function ensureHighlightStyle() {
  if (highlightStyleInjected) {
    return;
  }
  const style = document.createElement("style");
  style.setAttribute("data-assent", "highlight-style");
  style.textContent = `
    ::highlight(${HIGHLIGHT_NAME}) {
      background-color: #fff3cd;
      color: inherit;
      text-shadow: none;
    }
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
  try {
    if (typeof CSS !== "undefined" && CSS.highlights) {
      const h = CSS.highlights.get(HIGHLIGHT_NAME);
      if (h?.clear) {
        h.clear();
      } else if (h) {
        CSS.highlights.delete(HIGHLIGHT_NAME);
      }
    }
  } catch {}
  document.querySelectorAll("mark.assent-hl").forEach((m) => {
    const parent = m.parentNode;
    if (!parent) {
      return;
    }
    while (m.firstChild) {
      parent.insertBefore(m.firstChild, m);
    }
    parent.removeChild(m);
    parent.normalize?.();
  });
}

function normalizeChars(s) {
  return String(s)
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00AB\u00BB\u201F]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"')
    .replace(/[\u2013\u2014\u2212\u2010\u2011]/g, "-")
    .replace(/[\u00A0\u202F\u2009\u200A]/g, " ");
}

function highlightText(quote) {
  ensureHighlightStyle();
  const needle = normalizeChars(quote).replace(/\s+/g, " ").trim().toLowerCase();
  if (needle.length < 8) {
    console.warn("[Assent] highlight: needle too short", { quote });
    return false;
  }

  const { text, anchors } = buildNormalisedTextMap(document.body);
  if (text.length === 0) {
    console.warn("[Assent] highlight: empty page text buffer");
    return false;
  }

  const candidateLengths = [
    needle.length,
    Math.min(needle.length, 240),
    Math.min(needle.length, 120),
    Math.min(needle.length, 60),
    Math.min(needle.length, 30),
  ];

  const tried = new Set();
  const probesTried = [];
  for (const len of candidateLengths) {
    if (len < 12 || tried.has(len)) {
      continue;
    }
    tried.add(len);
    const probe = needle.slice(0, len);
    probesTried.push({ len, probe: `${probe.slice(0, 60)}...` });
    const idx = text.indexOf(probe);
    if (idx === -1) {
      continue;
    }
    const startAnchor = anchors[idx];
    const endAnchor = anchors[idx + probe.length - 1];
    if (!startAnchor || !endAnchor) {
      continue;
    }
    const range = buildRange(startAnchor, endAnchor);
    if (!range) {
      continue;
    }
    applyRangeHighlight(range);
    scrollRangeIntoView(range);
    return true;
  }
  console.warn("[Assent] highlight: no probe matched", {
    needlePreview: `${needle.slice(0, 80)}...`,
    needleLength: needle.length,
    bufferLength: text.length,
    probesTried,
  });
  return false;
}

const INLINE_TAGS = new Set([
  "A",
  "ABBR",
  "B",
  "BDI",
  "BDO",
  "BR",
  "CITE",
  "CODE",
  "DATA",
  "DEL",
  "DFN",
  "EM",
  "I",
  "INS",
  "KBD",
  "LABEL",
  "MARK",
  "Q",
  "RP",
  "RT",
  "RUBY",
  "S",
  "SAMP",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TIME",
  "U",
  "VAR",
  "WBR",
]);

function nearestBlockAncestor(node) {
  let el = node.parentElement;
  while (el && INLINE_TAGS.has(el.tagName)) {
    el = el.parentElement;
  }
  return el;
}

function buildNormalisedTextMap(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }
      const tag = parent.nodeName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue && node.nodeValue.length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  let buf = "";
  const anchors = [];
  let prevBlock = null;
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.nodeValue;
    const block = nearestBlockAncestor(node);
    if (prevBlock !== null && block !== prevBlock && buf.length > 0 && !buf.endsWith(" ")) {
      buf += " ";
      anchors.push({ node, rawIdx: 0 });
    }
    prevBlock = block;
    let inSpace = buf.length === 0 || buf.endsWith(" ");
    for (let i = 0; i < raw.length; i++) {
      const ch = normalizeChars(raw[i]);
      const isWs = /\s/.test(ch);
      if (isWs) {
        if (!inSpace) {
          buf += " ";
          anchors.push({ node, rawIdx: i });
          inSpace = true;
        }
      } else {
        buf += ch.toLowerCase();
        anchors.push({ node, rawIdx: i });
        inSpace = false;
      }
    }
  }
  return { text: buf, anchors };
}

function buildRange(startAnchor, endAnchor) {
  try {
    const range = document.createRange();
    const startLen = startAnchor.node.nodeValue?.length ?? 0;
    const endLen = endAnchor.node.nodeValue?.length ?? 0;
    range.setStart(startAnchor.node, Math.min(startAnchor.rawIdx, startLen));
    range.setEnd(endAnchor.node, Math.min(endAnchor.rawIdx + 1, endLen));
    return range;
  } catch {
    return null;
  }
}

function applyRangeHighlight(range) {
  if (typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined") {
    try {
      const existing = CSS.highlights.get(HIGHLIGHT_NAME);
      if (existing?.clear) {
        existing.clear();
      }
      const hl = existing ?? new Highlight();
      hl.add(range);
      CSS.highlights.set(HIGHLIGHT_NAME, hl);
      return;
    } catch {}
  }

  try {
    const mark = document.createElement("mark");
    mark.className = "assent-hl";
    range.surroundContents(mark);
  } catch {}
}

function scrollRangeIntoView(range) {
  try {
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      return;
    }
    const target = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
    window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  } catch {}
}

const OVERLAY_ID = "assent-floating-pill";

function ensureOverlay() {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    return existing;
  }
  const host = document.createElement("div");
  host.id = OVERLAY_ID;
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        font-family: system-ui, sans-serif;
      }
      .pill {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: #18181b;
        color: #e4e4e7;
        border: 1px solid #2a2a2e;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
        cursor: pointer;
        user-select: none;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .pill:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.55); }
      .pill.loading { cursor: default; }
      .grade {
        width: 22px; height: 22px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 12px;
      }
      .grade-A { background: #14532d; color: #4ade80; }
      .grade-B { background: #365314; color: #d9f99d; }
      .grade-C { background: #713f12; color: #fbbf24; }
      .grade-D { background: #7c2d12; color: #fb923c; }
      .grade-F { background: #7f1d1d; color: #f87171; }
      .spinner {
        width: 14px; height: 14px;
        border: 2px solid #2a2a2e;
        border-top-color: #a78bfa;
        border-radius: 50%;
        animation: assent-spin 0.8s linear infinite;
      }
      @keyframes assent-spin { to { transform: rotate(360deg); } }
      .close {
        margin-left: 4px;
        width: 18px; height: 18px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: transparent;
        color: #71717a;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
      }
      .close:hover { background: #2a2a2e; color: #e4e4e7; }
    </style>
    <div class="pill" id="root"></div>
  `;
  document.documentElement.appendChild(host);
  return host;
}

function tx(key, fallback) {
  try {
    return chrome.i18n.getMessage(key) || fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showOverlay(state) {
  const host = ensureOverlay();
  const shadow = host.shadowRoot;
  const root = shadow.getElementById("root");
  if (!root) {
    return;
  }

  if (state.kind === "loading") {
    root.className = "pill loading";
    root.innerHTML = `
      <div class="spinner"></div>
      <span>${escapeHtml(tx("overlayScanning", "Scanning…"))}</span>
    `;
    root.onclick = null;
  } else if (state.kind === "done") {
    root.className = "pill";
    root.innerHTML = `
      <div class="grade grade-${escapeHtml(state.grade)}">${escapeHtml(state.grade)}</div>
      <span>${escapeHtml(tx("overlayDone", "Open details"))}</span>
      <button class="close" id="assent-close" aria-label="Dismiss">×</button>
    `;
    root.onclick = (e) => {
      if (e.target.id === "assent-close") {
        host.remove();
        return;
      }
      chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" });
    };
  } else if (state.kind === "error") {
    root.className = "pill";
    root.innerHTML = `
      <span>${escapeHtml(tx("overlayError", "Analysis unavailable"))}</span>
      <button class="close" id="assent-close" aria-label="Dismiss">×</button>
    `;
    root.onclick = (e) => {
      if (e.target.id === "assent-close") {
        host.remove();
      }
    };
  }
}

function hideOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "HIGHLIGHT_QUOTE" && typeof msg.quote === "string") {
    clearHighlights();
    highlightText(msg.quote);
  } else if (msg?.type === "CLEAR_HIGHLIGHTS") {
    clearHighlights();
  } else if (msg?.type === "OVERLAY_UPDATE") {
    if (msg.state?.kind === "hide") {
      hideOverlay();
    } else {
      showOverlay(msg.state);
    }
  }
});

function quickReject() {
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
