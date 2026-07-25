const MIN_CONFIDENCE = 0.7;
const SUPPORTED_LANGUAGE = "en";

export async function detectLang(input, _ctx) {
  const source = input.tosText ?? "";
  const detected = await detectLanguage(source);

  if (detected && detected !== SUPPORTED_LANGUAGE) {
    return {
      value: {
        ...input,
        tosLanguage: detected,
        unsupportedLanguage: true,
      },
      done: true,
    };
  }

  return {
    value: { ...input, tosLanguage: SUPPORTED_LANGUAGE },
  };
}

async function detectLanguage(text) {
  if (typeof text !== "string" || text.length < 40) {
    return SUPPORTED_LANGUAGE;
  }
  try {
    if (!("LanguageDetector" in self)) {
      return SUPPORTED_LANGUAGE;
    }
    const availability = await self.LanguageDetector.availability();
    if (availability === "unavailable") {
      return SUPPORTED_LANGUAGE;
    }

    const detector = await self.LanguageDetector.create();
    const results = await detector.detect(text.slice(0, 4000));
    detector.destroy?.();

    const top = results?.[0];
    if (!top) {
      return SUPPORTED_LANGUAGE;
    }
    if (top.confidence < MIN_CONFIDENCE) {
      return SUPPORTED_LANGUAGE;
    }
    return top.detectedLanguage ?? SUPPORTED_LANGUAGE;
  } catch {
    return SUPPORTED_LANGUAGE;
  }
}

export { MIN_CONFIDENCE, SUPPORTED_LANGUAGE };
