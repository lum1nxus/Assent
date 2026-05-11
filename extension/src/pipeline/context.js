/**
 * Build a pipeline context for a single analysis run.
 *
 * The context object is passed to every step. It contains stable per-run state
 * (tabId, user language) plus runtime hooks (abort, progress).
 */

const SUPPORTED_UI_LANGUAGES = ["en", "de", "fr", "it", "pl", "nl"];
const DEFAULT_LANGUAGE = "en";

/**
 * @param {object} opts
 * @param {number} opts.tabId
 * @param {AbortSignal} [opts.abortSignal]
 * @param {(stepName: string) => void} [opts.onProgress]
 * @returns {object}
 */
export function buildContext({ tabId, abortSignal, onProgress }) {
  return {
    tabId,
    userLanguage: detectUserLanguage(),
    jurisdiction: "EU",
    abortSignal,
    onProgress,
  };
}

/**
 * Detect the user's preferred UI language.
 * Falls back to English for unsupported locales.
 */
export function detectUserLanguage() {
  try {
    const uiLocale = chrome.i18n?.getUILanguage?.() ?? navigator.language ?? "en";
    const primary = String(uiLocale).split("-")[0].toLowerCase();
    return SUPPORTED_UI_LANGUAGES.includes(primary) ? primary : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export { SUPPORTED_UI_LANGUAGES, DEFAULT_LANGUAGE };
