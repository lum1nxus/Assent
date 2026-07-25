const SPLICE_MARKERS = [/\.\.\./, /\u2026/, /\[\s*\.\.\.\s*\]/, /\[\s*omitted\s*\]/i];

export function quoteLooksSpliced(quote) {
  if (typeof quote !== "string" || quote.length === 0) {
    return false;
  }
  return SPLICE_MARKERS.some((p) => p.test(quote));
}
