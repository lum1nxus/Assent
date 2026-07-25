import { detectUserRegion } from "../features/user-region.js";

const DEFAULT_LANGUAGE = "en";

export async function buildContext({ tabId, abortSignal, onProgress }) {
  return {
    tabId,
    userLanguage: DEFAULT_LANGUAGE,
    userRegion: await detectUserRegion(),
    abortSignal,
    onProgress,
  };
}

export { DEFAULT_LANGUAGE };
