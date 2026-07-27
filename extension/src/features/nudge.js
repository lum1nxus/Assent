const URL_KEYWORDS = [
  "terms",
  "tos",
  "eula",
  "privacy",
  "legal",
  "agreement",
  "conditions",
  "datenschutz",
  "nutzungsbedingungen",
  "regulamin",
];

const ACCENT = "#a78bfa";

async function buildAccentIcon(size) {
  const url = chrome.runtime.getURL(`icons/icon-${size}.png`);
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, size, size);
  const r = Math.max(3, Math.round(size * 0.28));
  ctx.beginPath();
  ctx.arc(size - r, r, r, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

export async function setupNudge() {
  if (!chrome.declarativeContent?.onPageChanged) {
    return;
  }
  try {
    const [i16, i32] = await Promise.all([buildAccentIcon(16), buildAccentIcon(32)]);
    const conditions = URL_KEYWORDS.map(
      (kw) =>
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { pathContains: kw, schemes: ["https", "http"] },
        }),
    );
    await new Promise((resolve) => {
      chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions,
        actions: [new chrome.declarativeContent.SetIcon({ imageData: { 16: i16, 32: i32 } })],
      },
    ]);
  } catch {
    // The URL nudge is a best-effort visual hint; core scanning does not depend on it.
  }
}
