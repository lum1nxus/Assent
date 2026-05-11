import { computeScore } from "../rubric/score.js";
import { buildSummary } from "../rubric/summary.js";
import { topThree } from "../../features/top-three.js";

const KEY_PREFIX = "tab_";

const DISCLAIMER_TEXT =
  "Output produced by automated pattern detection running on the user's device. " +
  "Each flag references a verbatim excerpt from the document so the reader can verify it independently. " +
  "This is not a legal opinion, not legal advice, and is not affiliated with the publisher of the analysed document. " +
  "The score reflects language patterns only and may be incomplete or wrong. " +
  "Always read the original document before agreeing to any terms.";

export async function persist(input, ctx) {
  const flags = input.flags ?? [];
  const credits = input.credits ?? [];
  const { score, grade } = computeScore(flags, credits);
  const summary = buildSummary(flags);
  const highlights = topThree(flags);

  const result = {
    domain: input.domain,
    score,
    grade,
    serviceType: input.serviceType,
    summary,
    flags,
    credits,
    highlights,
    analyzedAt: input.analyzedAt,
    source: input.source,
    disclaimer: {
      not_legal_advice: true,
      not_affiliated: true,
      methodology_url: "https://github.com/lum1nxus/Assent#methodology",
      analyzed_at: input.analyzedAt,
      text: DISCLAIMER_TEXT,
    },
    _debug: {
      ...input._debug,
      extractedWords: input.extractedWords ?? null,
      tosLanguage: input.tosLanguage ?? null,
      jurisdictionContext: input.jurisdictionContext ?? null,
    },
  };

  await chrome.storage.session.set({
    [`${KEY_PREFIX}${ctx.tabId}`]: { status: "done", result },
  });

  return { value: result };
}

export { KEY_PREFIX };
