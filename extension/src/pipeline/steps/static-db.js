/**
 * Step: static-db
 *
 * Look up the domain in the bundled EU services database. If found, returns the
 * pre-computed analysis and short-circuits the pipeline.
 */

let _dbCache = null;

async function loadDB() {
  if (_dbCache) {
    return _dbCache;
  }
  const url = chrome.runtime.getURL("data/services.json");
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`services.json HTTP ${res.status}`);
  }
  _dbCache = await res.json();
  return _dbCache;
}

/**
 *
 */
function normalizeDomain(raw) {
  try {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return String(raw)
      .toLowerCase()
      .replace(/^www\./, "");
  }
}

/**
 * @param {{ domain: string, tosUrl: string, tosText?: string }} input
 * @param {object} _ctx
 * @returns {Promise<{value: object, done?: boolean}>}
 */
export async function staticDb(input, _ctx) {
  const domain = normalizeDomain(input.domain);
  const db = await loadDB();
  let entry = db.services[domain];

  if (entry?._ref) {
    entry = db.services[entry._ref];
  }

  if (!entry || typeof entry.score !== "number") {
    return { value: { ...input, domain, db } };
  }

  return {
    done: true,
    value: {
      source: "static_db",
      domain,
      score: entry.score,
      grade: entry.grade,
      serviceType: entry.serviceType,
      flags: entry.flags ?? [],
      credits: entry.credits ?? [],
      analyzedAt: entry.analyzedAt,
      tosVersion: entry.tosVersion,
      jurisdictionNote: entry.jurisdictionNote ?? null,
      summary: buildStaticSummary(entry),
      db,
    },
  };
}

function buildStaticSummary(entry) {
  const highFlags = (entry.flags ?? []).filter(
    (f) => f.severity === "high" || f.severity === "full",
  );
  if (highFlags.length === 0) {
    return "No major risk clauses detected in our pre-analyzed database.";
  }
  return `Contains ${highFlags[0].title.toLowerCase()} language. Risk score ${entry.score}/10 — pre-analyzed from the publicly available ToS document.`;
}

export { normalizeDomain };
