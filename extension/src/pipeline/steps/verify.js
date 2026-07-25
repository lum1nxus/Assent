import { parseLooseJson } from "./sanitize-json.js";
import { CATEGORY_REFERENCES } from "../rubric/reference-examples.js";
import { stripSensitiveTokens } from "../rubric/strip-sensitive-tokens.js";

const BATCH_SIZE = 5;
const VERIFY_SCHEMA = {
  type: "object",
  required: ["results"],
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        required: ["match", "reason"],
        additionalProperties: false,
        properties: {
          match: { type: "boolean" },
          reason: { type: "string" },
        },
      },
    },
  },
};

export async function verify(input, ctx) {
  const flags = Array.isArray(input.flags) ? input.flags : [];
  const credits = Array.isArray(input.credits) ? input.credits : [];

  if (flags.length === 0 && credits.length === 0) {
    return { value: input };
  }

  const verifier = ctx?.verifier ?? buildDefaultVerifier();
  const verifierContext = { rawResponses: {} };

  try {
    const verifiedFlags = await verifyGroup(flags, "flag", verifier, verifierContext);
    const verifiedCredits = await verifyGroup(credits, "credit", verifier, verifierContext);

    const sanitizedFlags = verifiedFlags.map((f) => ({
      ...f,
      verifierReason: stripSensitiveTokens(f.verifierReason, input.domain),
    }));
    const sanitizedCredits = verifiedCredits.map((c) => ({
      ...c,
      verifierReason: stripSensitiveTokens(c.verifierReason, input.domain),
    }));

    return {
      value: {
        ...input,
        flags: sanitizedFlags,
        credits: sanitizedCredits,
        _debug: {
          ...(input._debug ?? {}),
          verifierResponses: verifierContext.rawResponses,
        },
      },
    };
  } finally {
    verifier._destroy?.();
  }
}

async function verifyGroup(candidates, kind, verifier, verifierContext) {
  if (candidates.length === 0) {
    return [];
  }

  const groups = new Map();
  candidates.forEach((c, idx) => {
    if (!groups.has(c.category)) {
      groups.set(c.category, []);
    }
    groups.get(c.category).push({ idx, candidate: c });
  });

  const verdictByIdx = new Map();
  for (const [category, members] of groups) {
    const quotes = members.map((m) => m.candidate.quote);
    const batches = chunk(quotes, BATCH_SIZE);
    let cursor = 0;
    for (const batch of batches) {
      let verdicts;
      try {
        const { verdicts: v, raw } = await verifier(category, batch, kind);
        verdicts = v;
        verifierContext.rawResponses[`${kind}:${category}:${cursor}`] = raw;
      } catch (err) {
        verdicts = batch.map(() => ({
          match: true,
          reason: `verifier error (kept by default): ${err?.message ?? "unknown"}`,
          _failed: true,
        }));
        verifierContext.rawResponses[`${kind}:${category}:${cursor}`] = String(err?.message ?? err);
      }
      for (let i = 0; i < batch.length; i += 1) {
        const member = members[cursor + i];
        verdictByIdx.set(member.idx, verdicts[i] ?? { match: true, reason: "no verdict" });
      }
      cursor += batch.length;
    }
  }

  const accepted = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const verdict = verdictByIdx.get(i);
    if (!verdict || verdict.match) {
      accepted.push({
        ...candidates[i],
        verifierReason: verdict?.reason ?? null,
        verifierFailed: verdict?._failed ?? false,
      });
    }
  }
  return accepted;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) {
    out.push(arr.slice(i, i + n));
  }
  return out;
}

function buildDefaultVerifier() {
  let sharedSession = null;

  const getSession = async () => {
    if (sharedSession) {
      return sharedSession;
    }
    if (!("LanguageModel" in self)) {
      throw new Error("LanguageModel not available for verification");
    }
    sharedSession = await self.LanguageModel.create({
      temperature: 0,
      topK: 1,
    });
    return sharedSession;
  };

  const fn = async function defaultVerifier(category, quotes, kind) {
    const refs = CATEGORY_REFERENCES[category];
    if (!refs) {
      return {
        verdicts: quotes.map(() => ({
          match: true,
          reason: "no reference examples for this category; kept by default",
        })),
        raw: "no-references",
      };
    }
    const session = await getSession();
    const raw = await session.prompt(buildPrompt(category, kind, refs, quotes), {
      responseConstraint: VERIFY_SCHEMA,
    });
    const parsed = safeParseVerdicts(raw, quotes.length);
    return { verdicts: parsed, raw };
  };

  fn._destroy = () => {
    if (sharedSession) {
      try {
        sharedSession.destroy?.();
      } catch {}
      sharedSession = null;
    }
  };

  return fn;
}

function safeParseVerdicts(raw, expectedLength) {
  let obj;
  try {
    obj = parseLooseJson(raw);
  } catch {
    return Array.from({ length: expectedLength }, () => ({
      match: true,
      reason: "verifier returned invalid JSON; kept by default",
      _failed: true,
    }));
  }
  if (!obj || !Array.isArray(obj.results)) {
    return Array.from({ length: expectedLength }, () => ({
      match: true,
      reason: "verifier response missing results array; kept by default",
      _failed: true,
    }));
  }
  const out = [];
  for (let i = 0; i < expectedLength; i += 1) {
    const item = obj.results[i];
    if (item && typeof item.match === "boolean") {
      out.push({
        match: item.match,
        reason: typeof item.reason === "string" ? item.reason.slice(0, 240) : "",
      });
    } else {
      out.push({
        match: true,
        reason: "verifier returned no verdict for this entry; kept by default",
        _failed: true,
      });
    }
  }
  return out;
}

function buildPrompt(category, kind, refs, quotes) {
  const matchExamples = refs.match.map((s, i) => `${i + 1}. "${s}"`).join("\n");
  const notMatchExamples = refs.notMatch.map((s, i) => `${i + 1}. "${s}"`).join("\n");
  const clauseList = quotes.map((q, i) => `${i + 1}. "${q}"`).join("\n");
  return [
    `You are verifying ${kind} classifications. A previous step tagged each clause below as "${category}". For each clause, decide if the tag is correct.`,
    "",
    `Category: ${category}`,
    `Definition: ${refs.definition}`,
    "",
    "Examples that DO match this category:",
    matchExamples,
    "",
    "Examples that do NOT match this category (these look similar but are different):",
    notMatchExamples,
    "",
    "Clauses to verify:",
    clauseList,
    "",
    "READING RULES (apply to every clause):",
    "1. Read the WHOLE clause, end to end. Do not latch onto a single word.",
    "2. Words like 'non-exclusive', 'with or without notice', 'individual basis', 'as is', or 'to the extent permitted by law' are NEUTRAL on their own. They do not by themselves make a clause match or not-match. Look at what else the clause says.",
    "3. A clause matches the category if it expresses the SAME consumer-impact pattern as the MATCH examples, even if the exact wording differs.",
    "4. If a clause expresses ANY ONE of the broad-criteria traits listed in the Definition, that is enough to match - the user does not need to be hit by all of them.",
    "5. Pay attention to WHO is the subject. In legal English, 'user-initiated' and 'service-initiated' sentences look almost identical. If the sentence subject is the user (e.g. 'you may cancel'), it is NOT a service-initiated termination. If the sentence subject is the provider (e.g. 'we may terminate'), it IS. A service-side ownership claim is NOT the same as a user-grant licence.",
    "6. A quote that is ONLY a section heading, a definition entry, or a 'please read carefully' notice is NOT enough - the substantive obligation must be visible in the quote.",
    "",
    `Return STRICT JSON only, no markdown fences: { "results": [{"match": <bool>, "reason": "<one short sentence>"}] }. The results array MUST have exactly ${quotes.length} entries, in the same order as the clauses above. Do NOT name any company, brand, person, country, regulation, or law in any reason field.`,
  ].join("\n");
}
