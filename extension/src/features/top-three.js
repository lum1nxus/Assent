/**
 * Pick the three most severe flags from an analysis result so the side panel
 * can render a "top 3 things to know" summary block above the full flag list.
 *
 * Ordering: high > full > partial > low. Ties keep input order.
 */

const SEVERITY_RANK = { high: 0, full: 1, partial: 2, low: 3 };

/**
 * @param {Array<{ severity: string, title: string, quote?: string, id?: string }>} flags
 * @returns {Array<{ id?: string, title: string, severity: string, quote?: string }>}
 */
export function topThree(flags) {
  if (!Array.isArray(flags) || flags.length === 0) {
    return [];
  }
  return [...flags]
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
    .slice(0, 3)
    .map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      quote: f.quote,
    }));
}
