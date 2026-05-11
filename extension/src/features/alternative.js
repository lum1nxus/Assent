/**
 * Suggest a meaningfully better alternative service of the same type.
 *
 * Scans the static EU database for entries with the same `serviceType` and a
 * score at least 1.0 point lower than the current service. Returns the single
 * best (lowest score) match, or null if none qualifies.
 *
 * This is a unique Assent feature — no competitor (ToS;DR, PrivacySpy)
 * provides comparative alternatives.
 */

const MIN_DELTA = 1.0;

/**
 * @param {object} opts
 * @param {string} opts.currentDomain
 * @param {number} opts.currentScore
 * @param {string} opts.serviceType
 * @param {object} opts.db Parsed services.json
 * @returns {{ domain: string, score: number, grade: string } | null}
 */
export function suggestAlternative({ currentDomain, currentScore, serviceType, db }) {
  if (!db?.services || !Number.isFinite(currentScore) || !serviceType) {
    return null;
  }

  const candidates = [];
  for (const [domain, raw] of Object.entries(db.services)) {
    if (domain === currentDomain) {
      continue;
    }
    if (raw._ref) {
      continue;
    }
    if (raw.serviceType !== serviceType) {
      continue;
    }
    if (typeof raw.score !== "number") {
      continue;
    }
    if (currentScore - raw.score < MIN_DELTA) {
      continue;
    }
    candidates.push({ domain, score: raw.score, grade: raw.grade });
  }

  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0];
}
