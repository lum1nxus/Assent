import { parseLooseJson } from "./sanitize-json.js";

const BASE_SYSTEM_PROMPT = `You are an automated text-pattern analyser for consumer-facing legal documents.

You read a passage of a Terms of Service or similar document and identify language patterns that may be unfavourable to the consumer. You produce STRICT JSON only - no prose, no markdown fences.

Schema:
{
  "score": number,
  "serviceType": "fintech" | "social_media" | "content" | "marketplace" | "general_tech",
  "summary": string,
  "flags": [
    {
      "id": string,
      "severity": "high" | "full" | "partial",
      "title": string,
      "quote": string
    }
  ],
  "credits": [
    { "id": string, "title": string, "note": string }
  ]
}

Strict output rules:
- Be factual and neutral. Describe what the clause says, not what you think it means.
- Never name a company, brand, product, person, or third party in any output field (titles, summary, notes). Quotes are verbatim and are the only place such names may appear.
- Never name or reference any law, statute, regulation, directive, treaty, or compliance framework (no GDPR, DSA, DORA, MiCA, ePrivacy, CCPA, etc.) in any output field.
- Never use words like "evil", "predatory", "dangerous", "shady", "abusive", "unfair".
- Use phrasing such as: "broad", "high-risk", "unfavourable to consumers", "may permit", "appears to".
- Every flag MUST include a "quote" that is a verbatim substring of the input. If you cannot find an exact substring, omit the flag.
- Maximum 8 flags. Prioritise the most material risks.
- "summary" is a single neutral sentence, maximum 160 characters.
- Output ONLY valid JSON.

Score calibration - use the FULL 0-10 range, do NOT default to the middle:
- 0-2  Minimal data collection, transparent practices, easy account deletion, clear refund window, no arbitration, no broad content license, no unilateral changes without notice.
- 3-4  Mostly consumer-friendly: a few standard clauses (e.g., venue selection, limited license to user content needed to operate the service) but no aggressive provisions.
- 5-6  Typical commercial Terms: broad data-sharing with service providers, content license for service operation and promotion, standard limitation of liability, dispute resolution menu.
- 7-8  Several material risks: mandatory arbitration, class-action waiver, broad unilateral termination, very broad content license, vague data retention, broad indemnity from user to provider.
- 9-10 Severe stack: irrevocable broad content license, no deletion possible, data resale to undisclosed parties, no refund, unilateral changes without notice, mandatory arbitration in a distant venue with class-action waiver.
Different services should get different scores. If two documents differ in material risk, their scores MUST differ.

Rules for "flags" (clauses UNFAVOURABLE to the reader):
- Include only clauses that materially shift risk, money, or rights from the reader to the service: mandatory arbitration, class-action waiver, broad content license, broad data-sharing, unilateral changes, vague termination, broad indemnity, automatic renewal without a clear opt-out, broad limitation of liability, broad warranty disclaimer.
- "severity": "high" for clauses that strongly restrict the reader (mandatory arbitration, irrevocable broad license, account/content termination "at any time without notice"); "full" for fully formed unfavourable clauses; "partial" for clauses with mitigating language or narrow scope.

Rules for "credits" (clauses that GENUINELY PROTECT the reader):
- A credit is a clause that actively grants the reader a concrete protection or right: a stated refund window, easy account deletion (no friction, no waiting period), explicit opt-in before sharing personal data with third parties, no automatic renewal, a transparent data-retention period with deletion at the end, free data export, an opt-out from arbitration within a stated window.
- Do NOT include in credits: references to other documents (Privacy Policy, Community Guidelines, Cookie Policy), procedural clauses (governing law, jurisdiction, venue, survival, arbitration location, arbitration administrator), generic statements ("we comply with applicable law"), or any clause that is in fact unfavourable to the reader.
- If no genuinely protective clauses are present in the passage, return credits: [] - an empty array is correct and preferred over inventing credits.`;

const INTERNAL_CONTEXT_HEADER =
  "\n\nInternal context (do NOT mention any of the following in your output, do not name any country, region, or framework):";

const DOC_REGION_HINTS = {
  eu: "Document declares jurisdiction inside the EU/EEA.",
  "non-eu": "Document declares jurisdiction outside the EU/EEA.",
  unknown: "Document does not clearly declare a jurisdiction in the extracted portion.",
};

const USER_REGION_HINTS = {
  eu: "Reader is likely located in the EU/EEA, where mandatory consumer protections in the reader's country of residence apply to B2C services regardless of a governing-law clause.",
  "non-eu": "Reader is likely located outside the EU/EEA.",
  unknown: "Reader's location is unknown.",
};

const COMBO_GUIDANCE = {
  "eu|eu":
    "Treat consumer protection expectations as strong. Flag any clause that would surprise an EU-resident consumer (broad data sharing, unilateral changes, unclear withdrawal, mandatory arbitration in distant venues).",
  "eu|non-eu":
    "Document targets EU/EEA but reader is elsewhere. Describe what the clause says factually; do not assume reader has the same statutory protections.",
  "eu|unknown":
    "Use a balanced EU-style consumer protection frame, but avoid asserting the reader has any specific rights.",
  "non-eu|eu":
    "Document attempts to impose non-EU/EEA terms on a reader who is likely EU-resident. Carefully flag clauses that would be considered broad or one-sided by EU consumer standards, since the reader's residence-based protections may override parts of the document for B2C transactions.",
  "non-eu|non-eu":
    "Describe what the clause says factually. Both sides are outside the EU/EEA frame.",
  "non-eu|unknown":
    "Describe what the clause says factually. Apply neutral consumer protection phrasing.",
  "unknown|eu":
    "Reader is likely EU-resident. Apply EU consumer protection frame when describing broad or one-sided clauses, without naming any framework.",
  "unknown|non-eu": "Apply neutral consumer protection phrasing.",
  "unknown|unknown": "Apply neutral consumer protection phrasing.",
};

function buildSystemPrompt(jurisdictionContext, userRegion) {
  const docRegion = jurisdictionContext?.declaredRegion ?? "unknown";
  const usrRegion = userRegion?.region ?? "unknown";
  const combo = `${docRegion}|${usrRegion}`;
  const guidance = COMBO_GUIDANCE[combo] ?? COMBO_GUIDANCE["unknown|unknown"];

  return [
    BASE_SYSTEM_PROMPT,
    INTERNAL_CONTEXT_HEADER,
    `- ${DOC_REGION_HINTS[docRegion]}`,
    `- ${USER_REGION_HINTS[usrRegion]}`,
    `- Guidance: ${guidance}`,
    "Reminder: the items above are private context for your reasoning only. Output must remain neutral and must not name any country, region, statute, regulation, directive, or framework.",
  ].join("\n");
}

export async function analyze(input, ctx) {
  if (!("LanguageModel" in self)) {
    throw new Error("On-device language model is not available");
  }

  const availability = await self.LanguageModel.availability();
  if (availability === "unavailable") {
    throw new Error("On-device language model is unavailable");
  }

  const session = await self.LanguageModel.create({
    initialPrompts: [
      {
        role: "system",
        content: buildSystemPrompt(input.jurisdictionContext, ctx?.userRegion),
      },
    ],
  });

  let raw;
  try {
    raw = await session.prompt(input.textForAnalysis);
  } finally {
    session.destroy?.();
  }

  const brandTokens = extractBrandTokens(input.domain);
  const parsed = parseAndValidate(raw, brandTokens);
  return {
    value: {
      ...input,
      source: "ai",
      score: parsed.score,
      serviceType: parsed.serviceType,
      summary: parsed.summary,
      flags: parsed.flags,
      credits: parsed.credits,
      analyzedAt: new Date().toISOString(),
    },
  };
}

const FORBIDDEN_TERMS = [
  /\bGDPR\b/gi,
  /\bDSA\b/gi,
  /\bDORA\b/gi,
  /\bMiCA\b/gi,
  /\bMiFID\b/gi,
  /\bePrivacy\b/gi,
  /\bCCPA\b/gi,
  /\bCPRA\b/gi,
  /\bHIPAA\b/gi,
  /\bPIPEDA\b/gi,
  /\bAI Act\b/gi,
  /\bConsumer Rights Directive\b/gi,
  /\bUnfair Contract Terms Directive\b/gi,
  /\bdirective\s+\d+\/\d+/gi,
  /\barticle\s+\d+(?:\(\d+\))?\s+of\s+the\b/gi,
  /\bregulation\s+\(\w+\)\s+\d+\/\d+/gi,
];

function stripForbidden(text) {
  if (typeof text !== "string") {
    return text;
  }
  let cleaned = text;
  for (const pattern of FORBIDDEN_TERMS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

const TLD_LIKE = new Set([
  "com",
  "org",
  "net",
  "io",
  "co",
  "gov",
  "edu",
  "ac",
  "app",
  "dev",
  "info",
  "biz",
  "uk",
  "de",
  "fr",
  "ru",
  "by",
  "ua",
  "pl",
  "es",
  "it",
  "nl",
  "se",
  "no",
  "dk",
  "fi",
  "eu",
  "ca",
  "us",
  "au",
  "jp",
  "kr",
  "cn",
  "br",
  "in",
  "ch",
  "at",
  "be",
  "cz",
  "sk",
  "hu",
  "ro",
  "bg",
  "hr",
  "si",
  "lt",
  "lv",
  "ee",
  "ie",
  "pt",
  "gr",
  "tr",
  "rs",
  "ua",
]);

const GENERIC_SUBDOMAINS = new Set([
  "www",
  "policies",
  "policy",
  "legal",
  "terms",
  "help",
  "store",
  "support",
  "docs",
  "static",
  "cdn",
  "app",
  "api",
]);

function extractBrandTokens(domain) {
  if (!domain || typeof domain !== "string") {
    return [];
  }
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) {
    return [];
  }
  let i = labels.length - 1;
  while (i >= 0 && TLD_LIKE.has(labels[i])) {
    i--;
  }
  if (i < 0) {
    return [];
  }
  const brand = labels[i];
  if (!brand || brand.length < 3 || GENERIC_SUBDOMAINS.has(brand)) {
    return [];
  }
  return [brand];
}

function stripCompanyName(text, brandTokens) {
  if (typeof text !== "string" || !brandTokens || brandTokens.length === 0) {
    return text;
  }
  let result = text;
  for (const brand of brandTokens) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}(?:['’]s|s)?\\b`, "gi");
    result = result.replace(pattern, "the service");
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

function cleanField(text, brandTokens) {
  return stripCompanyName(stripForbidden(text), brandTokens);
}

function parseAndValidate(raw, brandTokens) {
  let obj;
  try {
    obj = parseLooseJson(raw);
  } catch (err) {
    throw new Error(`AI returned invalid JSON: ${err.message}`);
  }

  if (typeof obj !== "object" || obj === null) {
    throw new Error("AI response is not an object");
  }

  const score = clamp(Number(obj.score), 0, 10);
  const serviceType = [
    "fintech",
    "social_media",
    "content",
    "marketplace",
    "general_tech",
  ].includes(obj.serviceType)
    ? obj.serviceType
    : "general_tech";
  const summary =
    typeof obj.summary === "string" ? cleanField(obj.summary, brandTokens).slice(0, 200) : "";

  const flags = Array.isArray(obj.flags)
    ? obj.flags
        .filter(
          (f) =>
            f &&
            typeof f.id === "string" &&
            typeof f.title === "string" &&
            typeof f.quote === "string",
        )
        .map((f) => ({
          id: f.id.slice(0, 60),
          title: cleanField(f.title, brandTokens).slice(0, 80),
          severity: ["high", "full", "partial"].includes(f.severity) ? f.severity : "full",
          quote: f.quote.slice(0, 400),
        }))
        .filter((f) => f.title.length > 0)
        .slice(0, 8)
    : [];

  const credits = Array.isArray(obj.credits)
    ? obj.credits
        .filter((c) => c && typeof c.id === "string" && typeof c.title === "string")
        .map((c) => ({
          id: c.id.slice(0, 60),
          title: cleanField(c.title, brandTokens).slice(0, 80),
          note: typeof c.note === "string" ? cleanField(c.note, brandTokens).slice(0, 200) : "",
        }))
        .filter((c) => c.title.length > 0)
        .slice(0, 8)
    : [];

  return { score, serviceType, summary, flags, credits };
}

function clamp(n, min, max) {
  if (!Number.isFinite(n)) {
    return min;
  }
  return Math.max(min, Math.min(max, n));
}
