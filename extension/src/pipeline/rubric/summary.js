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

  const maxLabels = ranked.length >= 5 ? 3 : 2;
  const labels = ranked
    .slice(0, maxLabels)
    .map((f) => resolveTitle(f.category))
    .filter(Boolean);
  if (labels.length === 0) {
    return "";
  }

  if (typeof chrome !== "undefined" && chrome.i18n) {
    const key =
      labels.length >= 3
        ? "summaryTemplateThree"
        : labels.length === 2
          ? "summaryTemplateTwo"
          : "summaryTemplateOne";
    const msg = chrome.i18n.getMessage(key, labels.slice(0, labels.length));
    if (msg) {
      return msg;
    }
  }

  if (labels.length === 1) {
    return `Document contains: ${labels[0]}.`;
  }
  if (labels.length === 2) {
    return `Document contains: ${labels[0]} and ${labels[1]}.`;
  }
  return `Document contains: ${labels[0]}, ${labels[1]}, and ${labels[2]}.`;
}
