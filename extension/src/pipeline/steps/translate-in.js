const TARGET = "en";

export async function translateIn(input, _ctx) {
  if (!input.tosLanguage || input.tosLanguage === TARGET) {
    return { value: { ...input, textForAnalysis: input.extractedText } };
  }

  const translated = await translate(input.extractedText, input.tosLanguage, TARGET);
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
