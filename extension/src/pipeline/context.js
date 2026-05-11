import { detectUserRegion } from "../features/user-region.js";

const SUPPORTED_UI_LANGUAGES = [
  "be",
  "bg",
  "ca",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fi",
  "fr",
  "hr",
  "hu",
  "it",
  "lt",
  "lv",
  "nl",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sk",
  "sl",
  "sr",
  "sv",
  "tr",
  "uk",
];
const DEFAULT_LANGUAGE = "en";

export async function buildContext({ tabId, abortSignal, onProgress }) {
  return {
    tabId,
    userLanguage: detectUserLanguage(),
    userRegion: await detectUserRegion(),
    abortSignal,
    onProgress,
  };
}

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
