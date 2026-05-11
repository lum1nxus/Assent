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
