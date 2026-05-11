const SEVERITY_RANK = { high: 0, full: 1, partial: 2, low: 3 };

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
