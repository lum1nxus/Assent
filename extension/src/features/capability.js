export const CAP = Object.freeze({
  CHECKING: "checking",
  UNSUPPORTED_BROWSER: "unsupported_browser",
  UNAVAILABLE_HARDWARE: "unavailable_hardware",
  DOWNLOADABLE: "downloadable",
  DOWNLOADING: "downloading",
  READY: "ready",
});

export const LM_OPTIONS = Object.freeze({
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
});

export function mapAvailability(availability) {
  switch (availability) {
    case "available":
      return CAP.READY;
    case "downloadable":
      return CAP.DOWNLOADABLE;
    case "downloading":
      return CAP.DOWNLOADING;
    case "unavailable":
      return CAP.UNAVAILABLE_HARDWARE;
    default:
      return CAP.UNAVAILABLE_HARDWARE;
  }
}

export async function checkCapability(scope = globalThis) {
  if (
    !scope ||
    !("LanguageModel" in scope) ||
    typeof scope.LanguageModel?.availability !== "function"
  ) {
    return { state: CAP.UNSUPPORTED_BROWSER };
  }

  try {
    const availability = await scope.LanguageModel.availability(LM_OPTIONS);
    return { state: mapAvailability(availability), availability };
  } catch (err) {
    return { state: CAP.UNSUPPORTED_BROWSER, error: err?.message ?? String(err) };
  }
}

export function isReady(state) {
  return state === CAP.READY;
}

export function needsDownload(state) {
  return state === CAP.DOWNLOADABLE || state === CAP.DOWNLOADING;
}
