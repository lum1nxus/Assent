// Single source of truth for score → grade → colour/label.
//
// Both the deterministic scorer (pipeline/rubric/score.js) and the UI
// (sidepanel.js) derive from this one table, so the grade letter, the ring/label
// colour, and the risk wording can never drift out of sync. Previously these
// thresholds were hard-coded twice with different cut-offs, which is exactly how a
// green grade "B" ended up next to a yellow "Moderate risk" label.
//
// Bands are ordered by ascending `maxScore` (inclusive upper bound). A and B share
// the same colour/label on purpose — both read as "low risk" — while still being
// distinct grade letters. The CSS `.grade-*` badge colours (see sidepanel index.html)
// are keyed by the same grade letter and must stay in the same colour family as
// `colorVar` here.
export const RISK_BANDS = [
  {
    maxScore: 8,
    grade: "A",
    colorVar: "--green",
    labelKey: "scoreLabelLow",
    labelFallback: "Low risk",
  },
  {
    maxScore: 22,
    grade: "B",
    colorVar: "--green",
    labelKey: "scoreLabelLow",
    labelFallback: "Low risk",
  },
  {
    maxScore: 44,
    grade: "C",
    colorVar: "--yellow",
    labelKey: "scoreLabelMedium",
    labelFallback: "Moderate risk",
  },
  {
    maxScore: 65,
    grade: "D",
    colorVar: "--orange",
    labelKey: "scoreLabelHigh",
    labelFallback: "High risk",
  },
  {
    maxScore: Infinity,
    grade: "F",
    colorVar: "--red",
    labelKey: "scoreLabelExtreme",
    labelFallback: "Extreme risk",
  },
];

const WORST_BAND = RISK_BANDS[RISK_BANDS.length - 1];

// Non-finite / unknown scores fall back to the worst band, matching the previous
// gradeOf() behaviour of returning "F".
export function bandForScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) {
    return WORST_BAND;
  }
  return RISK_BANDS.find((band) => n <= band.maxScore) ?? WORST_BAND;
}
