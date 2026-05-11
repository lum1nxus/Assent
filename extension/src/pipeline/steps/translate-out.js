/**
 * Step: translate-out
 *
 * Translate AI-generated descriptions from English into the user's UI language.
 * Quotes are NEVER translated — they must match verbatim text in the original
 * ToS document for the side panel's click-to-highlight feature to work.
 *
 * Only fires when the result came from the AI step (source: "ai") AND the user
 * UI language is not English. Static DB results have hand-curated copy and skip
 * this step entirely (currently English; full i18n of the DB is post-MVP).
 */

const SOURCE = "en";

/**
 * @param {object} input
 * @param {{ userLanguage: string }} ctx
 * @returns {Promise<{ value: object }>}
 */
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
    return await self.Translator.create({ sourceLanguage: sourceLang, targetLanguage: targetLang });
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
