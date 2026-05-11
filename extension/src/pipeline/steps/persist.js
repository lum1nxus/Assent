/**
 * Step: persist
 *
 * Write the final result to chrome.storage.session keyed by tab id.
 * Using session storage (not local) means:
 *   - state survives service worker restarts (MV3 fix for vulnerability #1)
 *   - state auto-clears when the browser closes
 *   - nothing is written to disk
 */

import { scoreToGrade } from "../../features/grade.js";
import { topThree } from "../../features/top-three.js";
import { suggestAlternative } from "../../features/alternative.js";

const KEY_PREFIX = "tab_";

/**
 * @param {object} input
 * @param {{ tabId: number }} ctx
 * @returns {Promise<{ value: object }>}
 */
export async function persist(input, ctx) {
  const grade = input.grade ?? scoreToGrade(input.score);
  const highlights = topThree(input.flags ?? []);
  const alternative = input.db
    ? suggestAlternative({
        currentDomain: input.domain,
        currentScore: input.score,
        serviceType: input.serviceType,
        db: input.db,
      })
    : null;

  const disclaimer = buildDisclaimer({
    source: input.source,
    domain: input.domain,
    analyzedAt: input.analyzedAt,
  });

  const result = {
    domain: input.domain,
    score: input.score,
    grade,
    serviceType: input.serviceType,
    summary: input.summary,
    flags: input.flags ?? [],
    credits: input.credits ?? [],
    highlights,
    alternative,
    jurisdictionNote: input.jurisdictionNote ?? null,
    analyzedAt: input.analyzedAt,
    tosVersion: input.tosVersion ?? null,
    source: input.source,
    disclaimer,
  };

  await chrome.storage.session.set({
    [`${KEY_PREFIX}${ctx.tabId}`]: { status: "done", result },
  });

  return { value: result };
}

function buildDisclaimer({ source, domain, analyzedAt }) {
  const sourceText =
    source === "static_db"
      ? "Pre-analyzed entry from our curated EU database."
      : "Live analysis powered by on-device AI (Chrome built-in Gemini Nano).";
  const dateText = analyzedAt
    ? `Document version analyzed: ${new Date(analyzedAt).toLocaleDateString("en-GB")}.`
    : "";
  return {
    not_legal_advice: true,
    source,
    domain,
    methodology_url: "https://github.com/lum1nxus/Assent#methodology",
    analyzed_at: analyzedAt,
    text: `${sourceText} ${dateText} Automated pattern detection — this is not legal advice. Always read the full Terms of Service before agreeing.`,
  };
}

export { KEY_PREFIX };
