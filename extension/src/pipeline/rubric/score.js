import { CATEGORIES, SEVERITY_MULTIPLIER } from "./categories.js";
import { bandForScore } from "../../shared/risk-bands.js";

const CREDIT_CAP_FLOOR = 8;
const CREDIT_CAP_RATIO = 0.4;

export function computeScore(flags = [], credits = []) {
  let penalty = 0;
  if (Array.isArray(flags)) {
    for (const f of flags) {
      const cat = CATEGORIES[f?.category];
      if (!cat || cat.kind !== "flag") {
        continue;
      }
      const mul = SEVERITY_MULTIPLIER[f?.severity] ?? 1;
      penalty += cat.weight * mul;
    }
  }

  let bonus = 0;
  if (Array.isArray(credits)) {
    for (const c of credits) {
      const cat = CATEGORIES[c?.category];
      if (!cat || cat.kind !== "credit") {
        continue;
      }
      bonus += cat.weight;
    }
  }

  const bonusCap = Math.max(CREDIT_CAP_FLOOR, penalty * CREDIT_CAP_RATIO);
  const cappedBonus = Math.min(bonus, bonusCap);
  const raw = Math.round(penalty - cappedBonus);
  const score = clamp(raw, 0, 100);
  return { score, grade: gradeOf(score) };
}

export function gradeOf(score) {
  return bandForScore(score).grade;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
