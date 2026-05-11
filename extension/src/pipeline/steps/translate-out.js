const SOURCE = "en";

export async function translateOut(input, ctx) {
  if (input.source !== "ai" || ctx.userLanguage === SOURCE) {
    return { value: input };
  }

  const translator = await openTranslator(SOURCE, ctx.userLanguage);
  if (!translator) {
    return { value: input };
  }

  try {
    const summary = input.summary ? await safeTranslate(translator, input.summary) : input.summary;
    const flags = await Promise.all(
      (input.flags ?? []).map(async (f) => ({
        ...f,
        title: await safeTranslate(translator, f.title),
      })),
    );
    const credits = await Promise.all(
      (input.credits ?? []).map(async (c) => ({
        ...c,
        title: await safeTranslate(translator, c.title),
        note: c.note ? await safeTranslate(translator, c.note) : c.note,
      })),
    );
    return { value: { ...input, summary, flags, credits } };
  } finally {
    translator.destroy?.();
  }
}

async function openTranslator(sourceLang, targetLang) {
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
    return await self.Translator.create({
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });
  } catch {
    return null;
  }
}

async function safeTranslate(translator, text) {
  try {
    return await translator.translate(text);
  } catch {
    return text;
  }
}
