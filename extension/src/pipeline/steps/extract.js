const RISK_KEYWORDS = [
  "arbitrat",
  "class action",
  "dispute",
  "data",
  "privacy",
  "personal information",
  "third part",
  "liabil",
  "indemni",
  "terminat",
  "suspend",
  "intellect",
  "license",
  "content",
  "refund",
  "waiver",
  "governing law",
  "biometric",
  "track",
  "advertis",
  "ai ",
  "machine learning",
  "automat",
  "delete",
  "retain",
  "minor",
];

const MAX_WORDS = 1200;

export async function extract(input, _ctx) {
  const raw = (input.tosText ?? "").trim();
  if (!raw) {
    throw new Error("no document text to analyse");
  }

  const paragraphs = raw
    .split(/\n{2,}|\.\s{2,}|(?<=\.)\s+(?=[A-Z])/g)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40);

  const scored = paragraphs.map((text) => ({ text, score: scoreParagraph(text) }));
  scored.sort((a, b) => b.score - a.score);

  let words = 0;
  const kept = [];
  for (const { text, score } of scored) {
    if (score === 0) {
      break;
    }
    const w = wordCount(text);
    if (words + w > MAX_WORDS) {
      continue;
    }
    kept.push(text);
    words += w;
  }

  const extractedText = kept.join("\n\n");
  return {
    value: {
      ...input,
      extractedText: extractedText || raw.slice(0, MAX_WORDS * 6),
      extractedWords: words || wordCount(raw),
    },
  };
}

function scoreParagraph(text) {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of RISK_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 1;
    }
  }
  return score;
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}
