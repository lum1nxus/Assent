import { CAP, checkCapability } from "./src/features/capability.js";
import { ensureModelDownloaded } from "./src/features/model-download.js";

const PERF_FLAG_URL = "chrome://flags/#optimization-guide-on-device-model";
const VERSION_URL = "chrome://settings/help";
const ONBOARDING_DONE_KEY = "onboarding_completed";

const root = document.getElementById("state-root");

const t = (key, fallback = "") => {
  try {
    return chrome.i18n.getMessage(key) || fallback;
  } catch {
    return fallback;
  }
};

document.getElementById("brand-title").textContent = t("extName", "Assent");
document.getElementById("privacy-note").textContent = t("onbPrivacyNote", "");
document.getElementById("intro").textContent = t("onbIntro", "");
document.title = t("onbTitle", "Set up Assent");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let pollHandle = null;

function stopPolling() {
  if (pollHandle !== null) {
    clearTimeout(pollHandle);
    pollHandle = null;
  }
}

async function markCompleted() {
  try {
    await chrome.storage.local.set({ [ONBOARDING_DONE_KEY]: true });
  } catch {}
}

function codeRow(value) {
  return `
    <div class="code-row">
      <div class="code">${esc(value)}</div>
      <button class="btn-copy" data-copy="${esc(value)}">${esc(t("onbCopy", "Copy"))}</button>
    </div>`;
}

function wireCopyButtons() {
  root.querySelectorAll(".btn-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const value = btn.getAttribute("data-copy") ?? "";
      try {
        await navigator.clipboard.writeText(value);
        const prev = btn.textContent;
        btn.textContent = t("onbCopied", "Copied");
        setTimeout(() => {
          btn.textContent = prev;
        }, 1500);
      } catch {}
    });
  });
}

function wireRecheck() {
  root.querySelector("#recheck")?.addEventListener("click", () => {
    render({ state: CAP.CHECKING });
    detectAndRender();
  });
}

function renderReady() {
  markCompleted();
  root.innerHTML = `
    <div class="card-title"><span class="badge ok">✓</span>${esc(t("onbReadyTitle", "You're all set"))}</div>
    <div class="card-body">${esc(t("onbReadyBody", ""))}</div>`;
}

function renderChecking() {
  root.innerHTML = `
    <div class="card-title"><span class="spinner"></span>${esc(t("onbChecking", "Checking your device…"))}</div>`;
}

function renderDownloadable() {
  root.innerHTML = `
    <div class="card-title">${esc(t("onbDownloadableTitle", "One-time setup"))}</div>
    <div class="card-body">${esc(t("onbDownloadableBody", ""))}</div>
    <button class="btn btn-primary" id="download-btn">${esc(t("onbDownloadBtn", "Download & finish"))}</button>
    <div class="progress" id="progress" hidden><div class="progress-fill" id="progress-fill"></div></div>
    <div class="progress-label" id="progress-label" hidden></div>`;
  root.querySelector("#download-btn")?.addEventListener("click", startDownload);
}

function renderDownloading(fraction) {
  const known = typeof fraction === "number" && fraction > 0 && fraction < 1;
  root.innerHTML = `
    <div class="card-title">${esc(t("onbDownloadingTitle", "Downloading…"))}</div>
    <div class="card-body">${esc(t("onbDownloadingBody", ""))}</div>
    <div class="progress"><div class="progress-fill ${known ? "" : "indeterminate"}" id="progress-fill" style="${known ? `width:${Math.round(fraction * 100)}%` : ""}"></div></div>
    <div class="progress-label" id="progress-label">${known ? `${Math.round(fraction * 100)}%` : ""}</div>`;
}

function renderUnavailable() {
  root.innerHTML = `
    <div class="card-title"><span class="badge warn">!</span>${esc(t("onbUnavailableTitle", ""))}</div>
    <div class="card-body">${esc(t("onbUnavailableBody", ""))}</div>
    <ul class="reqs">
      <li>${esc(t("onbReqDisk", ""))}</li>
      <li>${esc(t("onbReqHardware", ""))}</li>
      <li>${esc(t("onbReqOs", ""))}</li>
    </ul>
    <div class="flag-box">
      <div class="flag-title">${esc(t("onbFlagTitle", ""))}</div>
      <div class="card-body">${esc(t("onbFlagBody", ""))}</div>
      ${codeRow(PERF_FLAG_URL)}
    </div>
    <button class="btn btn-secondary" id="recheck">${esc(t("onbRecheck", "Check again"))}</button>`;
  wireCopyButtons();
  wireRecheck();
}

function renderUnsupported() {
  root.innerHTML = `
    <div class="card-title"><span class="badge err">×</span>${esc(t("onbUnsupportedTitle", ""))}</div>
    <div class="card-body">${esc(t("onbUnsupportedBody", ""))}</div>
    <div class="flag-box">
      <div class="flag-title">${esc(t("onbCheckVersion", ""))}</div>
      ${codeRow(VERSION_URL)}
    </div>
    <button class="btn btn-secondary" id="recheck">${esc(t("onbRecheck", "Check again"))}</button>`;
  wireCopyButtons();
  wireRecheck();
}

function renderError() {
  root.innerHTML = `
    <div class="card-title"><span class="badge err">×</span>${esc(t("onbErrorTitle", "Something went wrong"))}</div>
    <div class="card-body">${esc(t("onbDownloadFailed", ""))}</div>
    <button class="btn btn-primary" id="recheck">${esc(t("onbRecheck", "Check again"))}</button>`;
  wireRecheck();
}

function render(result) {
  stopPolling();
  switch (result.state) {
    case CAP.READY:
      renderReady();
      break;
    case CAP.DOWNLOADABLE:
      renderDownloadable();
      break;
    case CAP.DOWNLOADING:
      renderDownloading();
      pollUntilResolved();
      break;
    case CAP.UNAVAILABLE_HARDWARE:
      renderUnavailable();
      break;
    case CAP.UNSUPPORTED_BROWSER:
      renderUnsupported();
      break;
    case CAP.CHECKING:
    default:
      renderChecking();
  }
}

async function startDownload() {
  const btn = root.querySelector("#download-btn");
  if (btn) {
    btn.disabled = true;
  }
  renderDownloading(0);
  try {
    await ensureModelDownloaded({
      onProgress: (fraction) => renderDownloading(fraction),
    });
    renderReady();
  } catch {
    const after = await checkCapability();
    if (after.state === CAP.READY) {
      renderReady();
    } else {
      renderError();
    }
  }
}

function pollUntilResolved(attempts = 0) {
  if (attempts > 600) {
    return;
  }
  pollHandle = setTimeout(async () => {
    const result = await checkCapability();
    if (result.state === CAP.DOWNLOADING) {
      pollUntilResolved(attempts + 1);
    } else {
      render(result);
    }
  }, 2000);
}

async function detectAndRender() {
  const result = await checkCapability();
  render(result);
}

renderChecking();
detectAndRender();
