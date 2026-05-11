import { CATEGORIES, SEVERITY_MULTIPLIER } from "./categories.js";

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

  const raw = Math.round(penalty - bonus);
  const score = clamp(raw, 0, 100);
  return { score, grade: gradeOf(score) };
}

export function gradeOf(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) {
    return "F";
  }
  if (n <= 12) {
    return "A";
  }
  if (n <= 25) {
    return "B";
  }
  if (n <= 45) {
    return "C";
  }
  if (n <= 70) {
    return "D";
  }
  return "F";
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
