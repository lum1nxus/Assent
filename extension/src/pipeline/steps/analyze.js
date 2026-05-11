import { parseLooseJson } from "./sanitize-json.js";
import {
  CATEGORIES,
  FLAG_CATEGORY_IDS,
  CREDIT_CATEGORY_IDS,
  SEVERITY_IDS,
} from "../rubric/categories.js";
import { resolveTitle } from "../rubric/labels.js";
import {
  quoteMatchesCategoryKeywords,
  quoteContainsNegation,
  quoteLooksSpliced,
} from "./category-guards.js";

const SERVICE_TYPES = ["fintech", "social_media", "content", "marketplace", "general_tech"];

const FLAG_DESCRIPTIONS = {
  mandatory_arbitration: "requires arbitration instead of court litigation",
  class_action_waiver: "waives the right to participate in a class action or class arbitration",
  broad_content_license_irrevocable:
    "grants the service an irrevocable, perpetual, or worldwide license to user content",
  unilateral_terms_change_no_notice:
    "allows the service to change the terms unilaterally without prior notice to the user",
  data_resale_undisclosed_parties:
    "permits selling or sharing personal data with unnamed third parties or 'partners'",
  broad_indemnity_from_user:
    "requires the user to indemnify the service against broad categories of claims",
  broad_limitation_of_liability:
    "limits the service's liability to a token amount or excludes broad categories of damages",
  broad_warranty_disclaimer:
    "disclaims warranties broadly, including merchantability and fitness for purpose, in ALL-CAPS legal language",
  broad_data_sharing_third_party:
    "permits sharing personal data with broad classes of third parties (advertisers, affiliates)",
  account_termination_no_notice:
    "allows the service to terminate the account at any time, at sole discretion, with no notice",
  content_removal_sole_discretion:
    "allows content removal at the service's sole discretion without an appeal path",
  auto_renewal_no_clear_optout:
    "subscription automatically renews and the opt-out mechanism is not clearly stated",
  retention_period_undefined:
    "retention period for personal data is unspecified, 'as long as necessary', or open-ended",
  governing_law_distant_venue:
    "forces dispute resolution in a distant or inconvenient venue, far from the typical reader",
  services_as_is:
    "service is provided 'AS IS' or 'AS AVAILABLE' with no commitments to function correctly",
  other_unfavourable_clause:
    "use sparingly; only for clear unfavourable clauses that do not fit any category above",
};

const CREDIT_DESCRIPTIONS = {
  explicit_refund_window: "a clear refund window of N days is stated",
  easy_account_deletion:
    "the user can self-delete the account from settings with no friction or waiting period",
  explicit_optin_data_sharing:
    "explicit OPT-IN (not opt-out) is required before sharing personal data with third parties",
  no_automatic_renewal: "the service explicitly states that subscriptions do NOT auto-renew",
  transparent_retention_period:
    "a specific data-retention period is stated with deletion at the end",
  free_data_export: "the service offers free export of user data in a portable format",
  arbitration_optout_window:
    "the user can opt out of arbitration within a stated window after signing up",
  user_retains_content_ownership:
    "the service explicitly states the user retains ownership of their content",
};

function buildCategoryCatalog() {
  const flagLines = FLAG_CATEGORY_IDS.map((id) => `  - ${id}: ${FLAG_DESCRIPTIONS[id]}`).join("\n");
  const creditLines = CREDIT_CATEGORY_IDS.map((id) => `  - ${id}: ${CREDIT_DESCRIPTIONS[id]}`).join(
    "\n",
  );
  return { flagLines, creditLines };
}

const { flagLines, creditLines } = buildCategoryCatalog();

const BASE_SYSTEM_PROMPT = `You are an automated text-pattern analyser for consumer-facing legal documents.

Read a passage of a Terms of Service, EULA, or similar document and identify clauses that match the closed taxonomy below. You output STRICT JSON only - no prose, no markdown fences.

Output schema:
{
  "serviceType": "fintech" | "social_media" | "content" | "marketplace" | "general_tech",
  "flags": [
    { "category": <flag id>, "severity": "high" | "full" | "partial", "quote": <verbatim substring of the input> }
  ],
  "credits": [
    { "category": <credit id>, "quote": <verbatim substring of the input> }
  ]
}

FLAG categories (clauses UNFAVOURABLE to the reader). Use only these ids:
${flagLines}

CREDIT categories (clauses that GENUINELY PROTECT the reader). Use only these ids:
${creditLines}

STRICT RULES:
- Use ONLY the category ids listed above. If a clause does not fit any id, omit it. Do not invent new ids.
- "quote" MUST be a verbatim substring of the input (preserve original case, punctuation, smart quotes). If you cannot find an exact substring, omit the entry.
- For flags, "severity" is "high" for the strongest restrictions (mandatory_arbitration, class_action_waiver, broad_content_license_irrevocable, account_termination_no_notice); "full" for fully formed unfavourable clauses; "partial" for clauses with mitigating language, narrow scope, or short duration.
- Procedural disclaimers that are required by law in most jurisdictions (force majeure, severability, third-party content disclaimers, governing law itself, jurisdiction notes like "some jurisdictions may not allow") are NOT flags unless they go beyond what is standard.
- Open-source release of code, transparency statements, and "we do not track" promises are NOT flags.
- Maximum 8 flags and 8 credits. Pick the most material entries.
- DO NOT name companies, brands, products, people, regulations, laws, statutes, directives, countries, or compliance frameworks in any field.
- Quotes are the only place where such names may appear (verbatim, since they are part of the document).
- Output ONLY valid JSON.

DISAMBIGUATION GUIDE - common near-miss patterns. If a passage looks like the NOT-MATCH column, omit it; do not coerce it into the closest category.

- mandatory_arbitration:
  MATCH: "Any dispute shall be resolved by binding individual arbitration."
  NOT MATCH: "You may, at your option, submit a dispute to arbitration." Optional or opt-in arbitration is not a flag.
- class_action_waiver:
  MATCH: "You waive any right to participate in a class action or class-wide arbitration."
  NOT MATCH: "Disputes will be resolved between the parties." Without an explicit waiver of class proceedings, omit the flag.
- broad_content_license_irrevocable:
  MATCH: "you grant us a perpetual, irrevocable, worldwide, royalty-free licence to use, modify, and sublicense it" (a licence to USER-submitted content).
  NOT MATCH: "We retain all intellectual property rights in our Services." This is the service's own IP, not a grant from the user.
- broad_warranty_disclaimer:
  MATCH: "THE SERVICE IS PROVIDED 'AS IS' WITHOUT WARRANTY OF ANY KIND."
  NOT MATCH: "SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES." This is a standard procedural disclaimer.
- broad_indemnity_from_user:
  MATCH: "You agree to indemnify, defend and hold us harmless from any claim."
  NOT MATCH: "Our liability is limited to amounts paid in the prior twelve months." That is broad_limitation_of_liability, not indemnity.
- broad_limitation_of_liability:
  MATCH: "Our aggregate liability is limited to the fees paid in the prior twelve months."
  NOT MATCH: "You agree to indemnify us." That is broad_indemnity_from_user.
- data_resale_undisclosed_parties:
  MATCH: "We may sell or share your information with third parties for marketing purposes."
  NOT MATCH: "We share payment data with our payment processor to charge your card." A named purpose with a specific sub-processor is not data resale.
- broad_data_sharing_third_party:
  MATCH: "We may share your information with our advertising and analytics partners."
  NOT MATCH: "We do not share your data with third parties unless you explicitly opt in." Opt-in language is a credit, not a flag.
- account_termination_no_notice:
  MATCH: "We may suspend or terminate your account at any time, at our sole discretion."
  NOT MATCH: "You may close your account at any time from settings." That is a credit (easy_account_deletion), not a flag.
- content_removal_sole_discretion:
  MATCH: "We may remove any content at our sole discretion."
  NOT MATCH: "You may delete your own posts at any time."
- unilateral_terms_change_no_notice:
  MATCH: "We may modify these Terms at any time without prior notice."
  NOT MATCH: "We will notify you of material changes at least 30 days in advance." Advance notice mitigates the flag - omit.
- auto_renewal_no_clear_optout:
  MATCH: "Your subscription automatically renews until you cancel" without a clear cancellation path.
  NOT MATCH: "We do not auto-renew subscriptions." That is a credit (no_automatic_renewal).
- services_as_is:
  MATCH: a short "Service is provided on an 'as is' basis" without a full ALL-CAPS warranty disclaimer.
  NOT MATCH: If a full ALL-CAPS warranty disclaimer is present, prefer broad_warranty_disclaimer instead and omit services_as_is.

EXAMPLE 1 - friendly Terms (privacy-focused service):
Input excerpt:
"We do not track you. You may delete your account at any time from settings. We do not auto-renew subscriptions. Our Services are provided on 'as is' basis. We retain billing data for 12 months and delete it thereafter."
Output:
{
  "serviceType": "general_tech",
  "flags": [
    { "category": "services_as_is", "severity": "partial", "quote": "Our Services are provided on 'as is' basis" }
  ],
  "credits": [
    { "category": "easy_account_deletion", "quote": "You may delete your account at any time from settings" },
    { "category": "no_automatic_renewal", "quote": "We do not auto-renew subscriptions" },
    { "category": "transparent_retention_period", "quote": "We retain billing data for 12 months and delete it thereafter" }
  ]
}

EXAMPLE 2 - aggressive Terms (social platform):
Input excerpt:
"By posting content you grant us a perpetual, irrevocable, worldwide, royalty-free licence to use, modify, and sublicense it. Any dispute shall be resolved by binding individual arbitration. You waive any right to participate in a class action. We may modify these Terms at any time without prior notice."
Output:
{
  "serviceType": "social_media",
  "flags": [
    { "category": "broad_content_license_irrevocable", "severity": "high", "quote": "you grant us a perpetual, irrevocable, worldwide, royalty-free licence to use, modify, and sublicense it" },
    { "category": "mandatory_arbitration", "severity": "high", "quote": "Any dispute shall be resolved by binding individual arbitration" },
    { "category": "class_action_waiver", "severity": "high", "quote": "You waive any right to participate in a class action" },
    { "category": "unilateral_terms_change_no_notice", "severity": "full", "quote": "We may modify these Terms at any time without prior notice" }
  ],
  "credits": []
}

EXAMPLE 3 - near-miss (do not flag standard procedural language):
Input excerpt:
"We retain all intellectual property rights in our Services, but we make the source code available under open-source licenses. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES, SO THE ABOVE EXCLUSION MAY NOT APPLY TO YOU. We are not responsible for content created by third parties."
Output:
{
  "serviceType": "general_tech",
  "flags": [],
  "credits": []
}`;

const DOC_REGION_HINTS = {
  eu: "The document declares jurisdiction inside the EU/EEA.",
  "non-eu": "The document declares jurisdiction outside the EU/EEA.",
  unknown: "The document does not clearly declare a jurisdiction.",
};

const USER_REGION_HINTS = {
  eu: "The reader is likely located in the EU/EEA.",
  "non-eu": "The reader is likely located outside the EU/EEA.",
  unknown: "The reader's location is unknown.",
};

function buildSystemPrompt(jurisdictionContext, userRegion) {
  const docRegion = jurisdictionContext?.declaredRegion ?? "unknown";
  const usrRegion = userRegion?.region ?? "unknown";
  return [
    BASE_SYSTEM_PROMPT,
    "",
    "Internal context (do NOT mention any of the below in your output):",
    `- ${DOC_REGION_HINTS[docRegion]}`,
    `- ${USER_REGION_HINTS[usrRegion]}`,
    "Reminder: output must remain neutral. Never name a country, region, regulation, or framework.",
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

  const parsed = parseAndValidate(raw, input.textForAnalysis ?? "");
  return {
    value: {
      ...input,
      source: "ai",
      serviceType: parsed.serviceType,
      flags: parsed.flags,
      credits: parsed.credits,
      analyzedAt: new Date().toISOString(),
      _debug: {
        rawAiResponse: raw,
        documentText: input.textForAnalysis ?? "",
      },
    },
  };
}

function normalizeForQuoteCheck(text) {
  return String(text)
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function quoteAppearsInDocument(quote, docNormalized) {
  if (typeof quote !== "string" || quote.length < 12) {
    return false;
  }
  const probe = normalizeForQuoteCheck(quote);
  if (probe.length < 12) {
    return false;
  }
  if (docNormalized.includes(probe)) {
    return true;
  }
  if (probe.length > 60) {
    const tail = probe.slice(-60);
    const head = probe.slice(0, 60);
    if (docNormalized.includes(head) && docNormalized.includes(tail)) {
      const headIdx = docNormalized.indexOf(head);
      const tailIdx = docNormalized.lastIndexOf(tail);
      if (tailIdx > headIdx && tailIdx - headIdx <= probe.length + 24) {
        return true;
      }
    }
    return false;
  }
  return false;
}

export function parseAndValidate(raw, docText) {
  let obj;
  try {
    obj = parseLooseJson(raw);
  } catch (err) {
    throw new Error(`AI returned invalid JSON: ${err.message}`);
  }

  if (typeof obj !== "object" || obj === null) {
    throw new Error("AI response is not an object");
  }

  const serviceType = SERVICE_TYPES.includes(obj.serviceType) ? obj.serviceType : "general_tech";
  const docNormalized = normalizeForQuoteCheck(docText);

  const seenFlagCats = new Set();
  const flags = Array.isArray(obj.flags)
    ? obj.flags
        .filter((f) => f && typeof f.category === "string" && typeof f.quote === "string")
        .map((f) => ({
          category: f.category,
          severity: SEVERITY_IDS.includes(f.severity) ? f.severity : "full",
          quote: f.quote.slice(0, 400),
        }))
        .filter((f) => CATEGORIES[f.category]?.kind === "flag")
        .filter((f) => !quoteLooksSpliced(f.quote))
        .filter((f) => quoteAppearsInDocument(f.quote, docNormalized))
        .filter((f) => quoteMatchesCategoryKeywords(f.quote, f.category, "flag"))
        .filter((f) => !quoteContainsNegation(f.quote))
        .filter((f) => {
          if (seenFlagCats.has(f.category)) {
            return false;
          }
          seenFlagCats.add(f.category);
          return true;
        })
        .map((f) => ({
          id: f.category,
          category: f.category,
          severity: f.severity,
          title: resolveTitle(f.category),
          quote: f.quote,
        }))
        .slice(0, 8)
    : [];

  const seenCreditCats = new Set();
  const credits = Array.isArray(obj.credits)
    ? obj.credits
        .filter((c) => c && typeof c.category === "string" && typeof c.quote === "string")
        .map((c) => ({
          category: c.category,
          quote: c.quote.slice(0, 400),
        }))
        .filter((c) => CATEGORIES[c.category]?.kind === "credit")
        .filter((c) => !quoteLooksSpliced(c.quote))
        .filter((c) => quoteAppearsInDocument(c.quote, docNormalized))
        .filter((c) => quoteMatchesCategoryKeywords(c.quote, c.category, "credit"))
        .filter((c) => {
          if (seenCreditCats.has(c.category)) {
            return false;
          }
          seenCreditCats.add(c.category);
          return true;
        })
        .map((c) => ({
          id: c.category,
          category: c.category,
          title: resolveTitle(c.category),
          quote: c.quote,
        }))
        .slice(0, 8)
    : [];

  return { serviceType, flags, credits };
}
