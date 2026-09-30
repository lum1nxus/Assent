// Deterministic "is this actually an agreement document?" gate.
//
// Scanning is user-initiated, so a user can press "Scan this page" on a random
// article, dashboard, or search result. Feeding arbitrary page text to the model
// risks hallucinated flags and a misleading grade. This step runs before the
// model (no inference cost) and short-circuits with `notAgreement` when the page
// shows no legal/agreement vocabulary at all.
//
// It is intentionally lenient: a real Terms/EULA/privacy document is saturated
// with this vocabulary, so we only reject pages with essentially none of it.

// Strong phrases: a single hit is enough to treat the page as an agreement/policy.
const STRONG_MARKERS = [
  "terms of service",
  "terms of use",
  "terms and conditions",
  "terms & conditions",
  "privacy policy",
  "cookie policy",
  "cookies policy",
  "end user license",
  "end-user license",
  "end user licence",
  "eula",
  "user agreement",
  "this agreement",
  "these terms",
  "by using",
  "by accessing",
  "you agree",
  "we may collect",
  "we collect",
  "personal data",
  "personal information",
  "governing law",
  "limitation of liability",
  "intellectual property",
  "disclaimer of warranties",
  "acceptable use",
  "data protection",
];

// Weaker legal keywords: several distinct hits together indicate an agreement.
const LEGAL_KEYWORDS = [
  "agreement",
  "terms",
  "liability",
  "liable",
  "indemnif",
  "warrant",
  "arbitrat",
  "jurisdiction",
  "dispute",
  "license",
  "licence",
  "privacy",
  "consent",
  "retention",
  "cookies",
  "disclaimer",
  "waive",
  "waiver",
  "terminate",
  "termination",
  "refund",
  "subscription",
  "auto-renew",
  "processing",
  "controller",
  "opt out",
  "opt-out",
  "sole discretion",
  "as is",
  "third party",
  "third-party",
];

const MIN_STRONG = 1;
const MIN_LEGAL = 6;

export function looksLikeAgreement(text) {
  const lower = String(text ?? "").toLowerCase();
  if (!lower.trim()) {
    return false;
  }

  let strong = 0;
  for (const marker of STRONG_MARKERS) {
    if (lower.includes(marker)) {
      strong += 1;
      if (strong >= MIN_STRONG) {
        return true;
      }
    }
  }

  let legal = 0;
  for (const keyword of LEGAL_KEYWORDS) {
    if (lower.includes(keyword)) {
      legal += 1;
      if (legal >= MIN_LEGAL) {
        return true;
      }
    }
  }

  return false;
}

export async function detectAgreement(input, _ctx) {
  const text = input.tosText ?? input.extractedText ?? "";
  if (looksLikeAgreement(text)) {
    return { value: input };
  }
  return {
    value: { ...input, notAgreement: true },
    done: true,
  };
}

export { MIN_STRONG, MIN_LEGAL };
