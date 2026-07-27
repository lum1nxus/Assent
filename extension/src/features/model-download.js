import { LM_OPTIONS } from "./capability.js";

export async function ensureModelDownloaded({ scope = globalThis, onProgress, signal } = {}) {
  if (!scope || !("LanguageModel" in scope) || typeof scope.LanguageModel?.create !== "function") {
    throw new Error("LanguageModel is not available");
  }

  const options = {
    ...LM_OPTIONS,
    monitor(m) {
      m.addEventListener("downloadprogress", (event) => {
        const loaded = typeof event?.loaded === "number" ? event.loaded : 0;
        onProgress?.(clampFraction(loaded));
      });
    },
  };
  if (signal) {
    options.signal = signal;
  }

  const session = await scope.LanguageModel.create(options);
  session?.destroy?.();
  onProgress?.(1);
  return true;
}

function clampFraction(n) {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(1, n));
}
