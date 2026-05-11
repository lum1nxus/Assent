const MIN_CONFIDENCE = 0.7;

export async function detectLang(input, _ctx) {
  const detectedLang = await detectLanguage(input.extractedText);
  return {
    value: { ...input, tosLanguage: detectedLang },
  };
}

async function detectLanguage(text) {
  try {
    if (!("LanguageDetector" in self)) {
      return "en";
    }
    const availability = await self.LanguageDetector.availability();
    if (availability === "unavailable") {
      return "en";
    }

    const detector = await self.LanguageDetector.create();
    const results = await detector.detect(text.slice(0, 4000));
    detector.destroy?.();

    const top = results?.[0];
    if (!top) {
      return "en";
    }
    if (top.confidence < MIN_CONFIDENCE) {
      return "en";
    }
    return top.detectedLanguage ?? "en";
  } catch {
    return "en";
  }
}
