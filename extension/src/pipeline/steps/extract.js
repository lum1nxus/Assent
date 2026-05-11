const RISK_KEYWORDS = [
  "arbitrat",
  "class action",
  "class-action",
  "class wide",
  "class-wide",
  "collective action",
  "dispute",
  "litigation",
  "waiv",
  "data",
  "privacy",
  "personal information",
  "personal data",
  "third part",
  "partner",
  "affiliate",
  "advertiser",
  "liabil",
  "liable",
  "damages",
  "indemnif",
  "hold harmless",
  "terminat",
  "suspend",
  "deactivat",
  "intellect",
  "license",
  "licence",
  "sublicens",
  "royalty",
  "royalty-free",
  "perpetual",
  "irrevocable",
  "worldwide",
  "content",
  "submit",
  "user content",
  "refund",
  "governing law",
  "jurisdiction",
  "venue",
  "forum",
  "biometric",
  "track",
  "tracker",
  "advertis",
  "ai ",
  "machine learning",
  "automat",
  "auto-renew",
  "auto renew",
  "automatic renewal",
  "delete",
  "deletion",
  "retain",
  "retention",
  "minor",
  "as is",
  "as available",
  "warrant",
  "merchantab",
  "fitness for",
  "disclaim",
  "sole discretion",
  "at our discretion",
  "without notice",
  "may modify",
  "may amend",
  "may change",
  "may update",
  "consent",
  "opt-in",
  "opt in",
  "opt-out",
  "opt out",
  "binding",
  "agreement",
  "indemn",
  "remov",
  "take-down",
  "takedown",
  "sell",
  "share",
  "disclose",
];

const MAX_WORDS = 2500;
const STRUCTURAL_SAMPLE_BUDGET = 600;
const STRUCTURAL_BUCKETS = 4;
const FALLBACK_CHAR_BUDGET = MAX_WORDS * 6;

export async function extract(input, _ctx) {
  const raw = (input.tosText ?? "").trim();
  if (!raw) {
    throw new Error("no document text to analyse");
  }

  const paragraphs = raw
    .split(/\n{2,}|\.\s{2,}|(?<=\.)\s+(?=[A-Z])/g)
    .map((p) => p.trim())
    .filter((p) => p.length >= 40);

  if (paragraphs.length === 0) {
    return {
      value: {
        ...input,
        extractedText: raw.slice(0, FALLBACK_CHAR_BUDGET),
        extractedWords: wordCount(raw.slice(0, FALLBACK_CHAR_BUDGET)),
      },
    };
  }

  const scored = paragraphs.map((text, idx) => ({
    text,
    idx,
    score: scoreParagraph(text),
    words: wordCount(text),
  }));

  const keptIdx = new Set();
  let words = 0;

  const topScoredBudget = Math.max(MAX_WORDS - STRUCTURAL_SAMPLE_BUDGET, Math.floor(MAX_WORDS * 0.5));
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  for (const p of byScore) {
    if (p.score === 0) {
      break;
    }
    if (words + p.words > topScoredBudget) {
      continue;
    }
    keptIdx.add(p.idx);
    words += p.words;
  }

  addStructuralSamples(scored, keptIdx, () => words, (w) => (words += w));

  if (words < Math.floor(MAX_WORDS * 0.3)) {
    fillFromAnywhere(scored, keptIdx, () => words, (w) => (words += w));
  }

  const ordered = [...keptIdx].sort((a, b) => a - b);
  const kept = ordered.map((i) => paragraphs[i]);

  const extractedText = kept.join("\n\n");
  return {
    value: {
      ...input,
      extractedText: extractedText || raw.slice(0, FALLBACK_CHAR_BUDGET),
      extractedWords: words || wordCount(raw),
    },
  };
}

function addStructuralSamples(scored, keptIdx, getWords, addWords) {
  const total = scored.length;
  if (total <= STRUCTURAL_BUCKETS) {
    return;
  }
  const perBucket = Math.ceil(total / STRUCTURAL_BUCKETS);
  for (let b = 0; b < STRUCTURAL_BUCKETS; b += 1) {
    const lo = b * perBucket;
    const hi = Math.min(total, (b + 1) * perBucket);
    const alreadyCovered = [...keptIdx].some((i) => i >= lo && i < hi);
    if (alreadyCovered) {
      continue;
    }
    const candidates = scored.slice(lo, hi).sort((left, right) => right.score - left.score);
    for (const c of candidates) {
      if (getWords() + c.words > MAX_WORDS) {
        continue;
      }
      keptIdx.add(c.idx);
      addWords(c.words);
      break;
    }
  }
}

function fillFromAnywhere(scored, keptIdx, getWords, addWords) {
  const remaining = scored.filter((p) => !keptIdx.has(p.idx));
  const total = scored.length;
  const stride = Math.max(1, Math.floor(total / Math.max(1, STRUCTURAL_BUCKETS * 2)));
  for (let i = 0; i < total; i += stride) {
    const candidate = remaining.find((p) => p.idx === i);
    if (!candidate) {
      continue;
    }
    if (getWords() + candidate.words > MAX_WORDS) {
      continue;
    }
    keptIdx.add(candidate.idx);
    addWords(candidate.words);
  }
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

export { MAX_WORDS, STRUCTURAL_SAMPLE_BUDGET, STRUCTURAL_BUCKETS };
