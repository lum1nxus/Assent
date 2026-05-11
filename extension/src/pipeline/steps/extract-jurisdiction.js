const EU_MEMBER_STATES = [
  "Austria",
  "Belgium",
  "Bulgaria",
  "Croatia",
  "Cyprus",
  "Czech Republic",
  "Czechia",
  "Denmark",
  "Estonia",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "Ireland",
  "Italy",
  "Latvia",
  "Lithuania",
  "Luxembourg",
  "Malta",
  "Netherlands",
  "Poland",
  "Portugal",
  "Romania",
  "Slovakia",
  "Slovenia",
  "Spain",
  "Sweden",
];

const EEA_NON_EU = ["Iceland", "Liechtenstein", "Norway"];

const COMMON_NON_EU = [
  "United States",
  "USA",
  "United Kingdom",
  "England",
  "Wales",
  "Scotland",
  "Northern Ireland",
  "Switzerland",
  "Russia",
  "Russian Federation",
  "Ukraine",
  "Belarus",
  "Turkey",
  "Türkiye",
  "United Arab Emirates",
  "UAE",
  "Singapore",
  "Hong Kong",
  "Japan",
  "Canada",
  "Australia",
  "India",
  "China",
  "Brazil",
];

const GOVERNING_LAW_PATTERNS = [
  /(?:governed|construed)\s+(?:by|in accordance with)\s+(?:the\s+)?laws?\s+of\s+(?:the\s+)?([A-Z][A-Za-z\s,&-]{1,60}?)(?=[.,;:\n]|\s+(?:without|except|and|exclusive|to))/g,
  /subject\s+to\s+the\s+laws?\s+of\s+(?:the\s+)?([A-Z][A-Za-z\s,&-]{1,60}?)(?=[.,;:\n]|\s+(?:without|and|exclusive))/g,
  /governing\s+law\s*[:.-]\s*(?:the\s+)?(?:laws?\s+of\s+)?(?:the\s+)?([A-Z][A-Za-z\s,&-]{1,60}?)(?=[.,;:\n])/g,
  /(?:exclusive\s+)?jurisdiction\s+of\s+the\s+courts?\s+of\s+(?:the\s+)?([A-Z][A-Za-z\s,&-]{1,60}?)(?=[.,;:\n]|\s+(?:and|or))/g,
];

const OPERATOR_PATTERNS = [
  /(?:operated|provided|owned|published)\s+by\s+([A-Z][\w&.\s,-]{1,80}?(?:\bInc\b|\bLtd\b|\bLLC\b|\bGmbH\b|\bS\.A\.|\bAB\b|\bSp\.\s?z\s?o\.o\.|\bB\.V\.|\bOy\b|\bAS\b|\bAG\b|\bPLC\b|\bLLP\b|\bSARL\b|\bSPA\b|\bBV\b))\.?/g,
  /this\s+(?:website|service|application|extension)\s+is\s+(?:operated|provided|owned)\s+by\s+([A-Z][\w&.\s,-]{1,80}?(?:\bInc\b|\bLtd\b|\bLLC\b|\bGmbH\b|\bS\.A\.|\bAB\b|\bB\.V\.|\bOy\b|\bAS\b|\bAG\b|\bPLC\b))\.?/g,
];

export async function extractJurisdiction(input, _ctx) {
  const haystack = `${input.textForAnalysis ?? ""}\n${input.extractedText ?? ""}`;

  const governingLaw = matchFirst(haystack, GOVERNING_LAW_PATTERNS);
  const operatorEntity = matchFirst(haystack, OPERATOR_PATTERNS);

  const declaredRegion = classifyRegion(governingLaw, operatorEntity);
  const confidence = governingLaw ? "high" : operatorEntity ? "low" : "none";

  return {
    value: {
      ...input,
      jurisdictionContext: {
        governingLaw,
        operatorEntity,
        declaredRegion,
        confidence,
      },
    },
  };
}

function matchFirst(text, patterns) {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match?.[1]) {
      return cleanCapture(match[1]);
    }
  }
  return null;
}

function cleanCapture(raw) {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[,.;:]\s*$/, "")
    .trim()
    .slice(0, 80);
}

function classifyRegion(governingLaw, operatorEntity) {
  const signals = [governingLaw, operatorEntity].filter(Boolean).join(" ");
  if (!signals) {
    return "unknown";
  }

  const lower = signals.toLowerCase();
  if (containsAny(lower, EU_MEMBER_STATES) || containsAny(lower, EEA_NON_EU)) {
    return "eu";
  }
  if (containsAny(lower, COMMON_NON_EU)) {
    return "non-eu";
  }
  return "unknown";
}

function containsAny(text, list) {
  return list.some((name) => text.includes(name.toLowerCase()));
}
