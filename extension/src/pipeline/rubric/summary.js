import { CATEGORIES, SEVERITY_MULTIPLIER } from "./categories.js";
import { resolveTitle } from "./labels.js";

export function buildSummary(flags = []) {
  if (!Array.isArray(flags) || flags.length === 0) {
    return "";
  }

  const ranked = flags
    .filter((f) => CATEGORIES[f?.category])
    .map((f) => ({
      f,
      weight: (CATEGORIES[f.category]?.weight ?? 0) * (SEVERITY_MULTIPLIER[f?.severity] ?? 1),
    }))
    .sort((a, b) => b.weight - a.weight)
    .map((r) => r.f);

  const labels = ranked
    .slice(0, 2)
    .map((f) => resolveTitle(f.category))
    .filter(Boolean);
  if (labels.length === 0) {
    return "";
  }

  if (typeof chrome !== "undefined" && chrome.i18n) {
    const key = labels.length === 1 ? "summaryTemplateOne" : "summaryTemplateTwo";
    const msg = chrome.i18n.getMessage(key, labels.slice(0, 2));
    if (msg) {
      return msg;
    }
  }

  return labels.length === 1
    ? `Document contains: ${labels[0]}.`
    : `Document contains: ${labels[0]} and ${labels[1]}.`;
}
