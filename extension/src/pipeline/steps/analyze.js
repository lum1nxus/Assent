import { parseLooseJson } from "./sanitize-json.js";
import {
  CATEGORIES,
  FLAG_CATEGORY_IDS,
  CREDIT_CATEGORY_IDS,
  SEVERITY_IDS,
} from "../rubric/categories.js";
import { resolveTitle } from "../rubric/labels.js";
import { quoteLooksSpliced } from "./category-guards.js";
import { LM_OPTIONS } from "../../features/capability.js";

const SERVICE_TYPES = ["fintech", "social_media", "content", "marketplace", "general_tech"];

const MAX_ITEMS = 6;
const MIN_QUOTE_LENGTH = 20;
const MAX_QUOTE_LENGTH = 400;

const ANALYZE_SCHEMA = {
  type: "object",
  required: ["serviceType", "flags", "credits"],
  additionalProperties: false,
  properties: {
    serviceType: { type: "string", enum: [...SERVICE_TYPES] },
    flags: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        required: ["category", "severity", "quote"],
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: [...FLAG_CATEGORY_IDS] },
          severity: { type: "string", enum: [...SEVERITY_IDS] },
          quote: {
            type: "string",
            minLength: MIN_QUOTE_LENGTH,
            maxLength: MAX_QUOTE_LENGTH,
          },
        },
      },
    },
    credits: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        required: ["category", "quote"],
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: [...CREDIT_CATEGORY_IDS] },
          quote: {
            type: "string",
            minLength: MIN_QUOTE_LENGTH,
            maxLength: MAX_QUOTE_LENGTH,
          },
        },
      },
    },
  },
};

const FLAG_DESCRIPTIONS = {
  mandatory_arbitration: "disputes must go through arbitration, not a public court",
  class_action_waiver: "the reader cannot join a group lawsuit",
  broad_content_license_irrevocable:
    "the reader gives the service very wide rights over content the reader submits",
  unilateral_terms_change_no_notice:
    "the service can change the deal on its own, without warning the reader first",
  data_resale_undisclosed_parties:
    "the service can pass personal data to outside groups it does not name",
  broad_indemnity_from_user:
    "the reader promises to pay the service's legal costs in broad situations",
  broad_limitation_of_liability:
    "the service is not on the hook for most damage its actions might cause",
  broad_warranty_disclaimer:
    "the service makes no promises the product will work correctly, usually in all-caps",
  broad_data_sharing_third_party:
    "personal data is shared with wide classes of outside groups such as advertisers",
  account_termination_no_notice:
    "the service can shut down the reader's account whenever it chooses, without warning",
  content_removal_sole_discretion:
    "the service can take down the reader's content whenever it chooses, without appeal",
  auto_renewal_no_clear_optout:
    "the subscription renews itself and the way to stop it is not made obvious",
  retention_period_undefined:
    "there is no clear time limit for how long the service keeps personal data",
  governing_law_distant_venue:
    "any legal fight must happen somewhere far from where the typical reader lives",
  services_as_is: "the service is offered 'as is' with no promises about what it will do",
  other_unfavourable_clause: "a clearly unfavourable clause that does not fit any of the ids above",
};

const CREDIT_DESCRIPTIONS = {
  explicit_refund_window: "a specific number of days during which the reader can get a refund",
  easy_account_deletion:
    "the reader can close the account from settings without contacting support",
  explicit_optin_data_sharing:
    "the reader must actively agree before personal data is shared with outside groups",
  no_automatic_renewal: "the reader has to renew a subscription manually",
  transparent_retention_period: "a specific time limit for keeping personal data is stated",
  free_data_export: "the reader can download their own data at no cost",
  arbitration_optout_window:
    "the reader can escape arbitration by opting out within a stated window",
  user_retains_content_ownership: "the reader keeps ownership of content the reader submits",
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

You will be given a passage of a Terms of Service, EULA, or similar document. Identify clauses in that passage that match the closed taxonomy below. Output STRICT JSON only - no prose, no markdown fences.

CRITICAL anti-hallucination rule (read this twice):
- Every "quote" you output MUST be a verbatim contiguous substring of the user's input passage, character for character, including punctuation and casing.
- Before adding any entry, locate the exact substring in the input. If you cannot find one, OMIT that entry.
- Do NOT paraphrase. Do NOT write generic legal template language. Do NOT echo phrasing from this system prompt or from anything that "sounds like a typical ToS". Quotes come ONLY from the user's input.
- Returning fewer entries (or zero) is correct when the input contains no exact match. Returning fabricated entries is a failure.
- Do NOT use ellipsis (...) or any omission marker inside a quote. Use one continuous substring.

Quote-selection rules:
- A quote must contain the SUBSTANTIVE obligation, not just a section heading or a "please read carefully" notice. If the passage has a heading like "Settling Disputes" or "Class Action Waiver", look for the actual rule underneath and quote THAT.
- A quote must contain the OPERATIVE clause text, not a definition entry. "Losses means..." defines a term and is not by itself a limitation-of-liability clause.
- Aim for quotes of roughly 12 to 60 words. Long enough to be unambiguous, short enough to be a single contiguous obligation.

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
- For flags, "severity" is "high" for the strongest restrictions (mandatory_arbitration, class_action_waiver, broad_content_license_irrevocable, account_termination_no_notice); "full" for fully formed unfavourable clauses; "partial" for clauses with mitigating language, narrow scope, or short duration.
- Procedural disclaimers that are required by law in most jurisdictions (force majeure, severability, third-party content disclaimers, governing law itself, jurisdiction notes like "some jurisdictions may not allow") are NOT flags unless they go beyond what is standard.
- Open-source release of code, transparency statements, and "we do not track" promises are NOT flags.
- Maximum 6 flags and 6 credits. Pick the most material entries actually present in the input. Prefer fewer high-quality entries over many marginal ones.
- Keep each "quote" between 20 and 50 words. Do not exceed 60 words in any single quote.
- DO NOT name companies, brands, products, people, regulations, laws, statutes, directives, countries, or compliance frameworks anywhere except inside a quote (where they appear because the document mentions them verbatim).
- Output ONLY valid JSON.

NEGATIVE DISAMBIGUATION RULES. These rules tell you when NOT to pick a category. They do not tell you what to write - they tell you what to avoid. Do NOT copy any wording from this section into a "quote".

Flags:
- mandatory_arbitration: if the arbitration is described as optional, opt-in, or "you may", do NOT pick this.
- class_action_waiver: if the clause is only procedural dispute-resolution language and never says the reader waives group proceedings, do NOT pick this.
- broad_content_license_irrevocable: if the clause is about the service or its licensors OWNING the platform, catalogue or software (service-side IP), do NOT pick this. The clause must show the reader granting the licence.
- broad_warranty_disclaimer: if the clause is only the boilerplate "some jurisdictions may not allow" line, do NOT pick this.
- broad_indemnity_from_user: if the clause caps the SERVICE'S own liability instead of asking the reader to pay the service's costs, do NOT pick this - use broad_limitation_of_liability instead.
- broad_limitation_of_liability: if the clause obliges the reader to pay the service's legal costs, do NOT pick this - use broad_indemnity_from_user.
- data_resale_undisclosed_parties: if the third party is named and the purpose is stated, do NOT pick this.
- broad_data_sharing_third_party: if the sharing requires prior opt-in by the reader, do NOT pick this - it is a credit.
- account_termination_no_notice: if the sentence subject is the reader ("you may cancel"), do NOT pick this. It has to be the service acting.
- content_removal_sole_discretion: if there is a stated appeal path or a stated notice window, do NOT pick this.
- unilateral_terms_change_no_notice: if the clause requires advance notice or the reader's consent before changes, do NOT pick this.
- auto_renewal_no_clear_optout: if the opt-out path is clearly stated (a settings page, a checkbox, a specific instruction), do NOT pick this.
- retention_period_undefined: if a concrete numeric retention period is stated, do NOT pick this - it is a credit.
- governing_law_distant_venue: if the clause is only a neutral choice-of-law statement that leaves consumer venue rights intact, do NOT pick this.
- services_as_is: if the same passage also contains ALL-CAPS disclaimer of any warranty, warranty of merchantability, fitness, accuracy, non-infringement, or "we make no representation or warranty", do NOT pick services_as_is - use broad_warranty_disclaimer. Never tag the same passage as both.
- other_unfavourable_clause: if the clause is clearly captured by one of the specific ids above, do NOT pick this.

Credits (the sentence subject must be the reader, not the service):
- explicit_refund_window: if the clause is only a statutory withdrawal-period reminder with no service-offered refund, do NOT pick this.
- easy_account_deletion: if the reader must contact support, wait a period, or write a letter, do NOT pick this.
- explicit_optin_data_sharing: if consent is deemed by using the service rather than actively given, do NOT pick this.
- no_automatic_renewal: if the clause simply describes how auto-renewal works, do NOT pick this.
- transparent_retention_period: if the period is vague ("as long as necessary"), do NOT pick this.
- free_data_export: if export requires payment, do NOT pick this.
- arbitration_optout_window: if the clause describes the arbitration itself, not how to opt out, do NOT pick this.
- user_retains_content_ownership: if the clause is about service-side ownership of the platform or software, do NOT pick this. It has to say the reader keeps their own content.

SELF-CHECK BEFORE YOU EMIT JSON.
Step 1: for each entry you intend to emit, locate the quote verbatim in the user's input. If you cannot find it as one continuous substring, drop the entry.
Step 2: for each entry, apply the NEGATIVE DISAMBIGUATION rules for that category. If any negative rule applies, drop the entry.
Step 3: check that no quote is only a section heading, a definition entry, or a "please read carefully" notice. Drop the entry if it is.
Step 4: check that no quote or reason mentions a company, brand, product, person, country, regulation or law that is not already visible in the input.
Step 5: emit the JSON.`;

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

  const availability = await self.LanguageModel.availability(LM_OPTIONS);
  if (availability === "unavailable") {
    throw new Error("On-device language model is unavailable");
  }

  const session = await self.LanguageModel.create({
    ...LM_OPTIONS,
    temperature: 0,
    topK: 1,
    initialPrompts: [
      {
        role: "system",
        content: buildSystemPrompt(input.jurisdictionContext, ctx?.userRegion),
      },
    ],
  });

  let raw;
  let promptText = input.extractedText ?? "";
  try {
    promptText = await fitToInputBudget(session, promptText);
    raw = await session.prompt(promptText, {
      responseConstraint: ANALYZE_SCHEMA,
    });
  } finally {
    session.destroy?.();
  }

  const parsed = parseAndValidate(raw, promptText);
  return {
    value: {
      ...input,
      source: "ai",
      serviceType: parsed.serviceType,
      flags: parsed.flags,
      credits: parsed.credits,
      analyzedAt: new Date().toISOString(),
      stageAStats: parsed._stageAStats,
      _debug: {
        rawAiResponse: raw,
        documentText: promptText,
        stageAStats: parsed._stageAStats,
      },
    },
  };
}

// Trim the document so the system prompt + document fit the model's input
// quota. The system prompt is large, so a full extraction can overflow Gemini
// Nano's context; measureInputUsage lets us shrink it deterministically.
export async function fitToInputBudget(session, text) {
  if (!text || typeof session?.measureInputUsage !== "function") {
    return text;
  }
  const quota = Number(session.inputQuota);
  if (!Number.isFinite(quota) || quota <= 0) {
    return text;
  }
  const used = Number(session.inputUsage) || 0;
  const margin = 128;
  const budget = quota - used - margin;
  if (budget <= 0) {
    return text;
  }
  try {
    let candidate = text;
    let need = await session.measureInputUsage(candidate);
    for (let i = 0; i < 5 && need > budget && candidate.length > 0; i += 1) {
      const ratio = budget / need;
      const nextLen = Math.max(0, Math.floor(candidate.length * ratio * 0.9));
      if (nextLen >= candidate.length) {
        break;
      }
      candidate = candidate.slice(0, nextLen);
      need = await session.measureInputUsage(candidate);
    }
    return candidate;
  } catch {
    return text;
  }
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
  return docNormalized.includes(probe);
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

  const rawFlagCount = Array.isArray(obj.flags)
    ? obj.flags.filter(
        (f) =>
          f &&
          typeof f.quote === "string" &&
          f.quote.length >= 12 &&
          typeof f.category === "string" &&
          CATEGORIES[f.category]?.kind === "flag",
      ).length
    : 0;
  const rawCreditCount = Array.isArray(obj.credits)
    ? obj.credits.filter(
        (c) =>
          c &&
          typeof c.quote === "string" &&
          c.quote.length >= 12 &&
          typeof c.category === "string" &&
          CATEGORIES[c.category]?.kind === "credit",
      ).length
    : 0;

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
        .slice(0, 6)
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
        .slice(0, 6)
    : [];

  const lowRecall = rawFlagCount >= 3 && flags.length === 0;

  return {
    serviceType,
    flags,
    credits,
    _stageAStats: {
      rawFlagCount,
      rawCreditCount,
      survivedFlagCount: flags.length,
      survivedCreditCount: credits.length,
      lowRecall,
    },
  };
}
