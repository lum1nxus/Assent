/**
 * Step: translate-in
 *
 * If the detected ToS language is not English, translate the extracted text
 * to English using Chrome's built-in Translator API. Gemini Nano produces
 * higher quality output on English input.
 *
 * Spec: https://developer.chrome.com/docs/ai/translator-api
 *
 * If the translator is unavailable for the language pair, we pass the text
 * through unchanged — Gemini Nano can still handle DE/FR/IT/PL/NL with lower
 * but acceptable quality.
 */

const SOURCE_TARGET = "en";

/**
 * @param {{ extractedText: string, tosLanguage: string }} input
 * @returns {Promise<{ value: object }>}
 */
export async function translateIn(input, _ctx) {
  if (!input.tosLanguage || input.tosLanguage === SOURCE_TARGET) {
    return { value: { ...input, textForAnalysis: input.extractedText } };
  }

  const translated = await translate(input.extractedText, input.tosLanguage, SOURCE_TARGET);
  return {
    value: { ...input, textForAnalysis: translated ?? input.extractedText },
  };
}

async function translate(text, sourceLang, targetLang) {
  try {
    if (!("Translator" in self)) {
      return null;
    }
    const availability = await self.Translator.availability({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });
    if (availability === "unavailable") {
      return null;
    }

    const translator = await self.Translator.create({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });
    const out = await translator.translate(text);
    translator.destroy?.();
    return out;
  } catch {
    return null;
  }
}
