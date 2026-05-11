/**
 * Map a numeric risk score (0–10) to a letter grade A–F.
 *
 * Aligns with the visual convention used by ToS;DR and similar tools so
 * users can scan quickly. A is best (most user-friendly), F is worst.
 */

/**
 * @param {number} score 0..10 (higher = more user-hostile)
 * @returns {"A"|"B"|"C"|"D"|"F"}
 */
export function scoreToGrade(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) {
    return "F";
  }
  if (n <= 2.0) {
    return "A";
  }
  if (n <= 3.5) {
    return "B";
  }
  if (n <= 5.5) {
    return "C";
  }
  if (n <= 7.5) {
    return "D";
  }
  return "F";
}
