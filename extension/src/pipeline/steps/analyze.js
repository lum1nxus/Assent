/**
 * Step: analyze
 *
 * Run Chrome's built-in LanguageModel (Prompt API, Gemini Nano) on the
 * extracted/translated ToS text. The prompt enforces a strict JSON schema
 * and requires a verbatim `quote` field for every flag so the side panel
 * can highlight the passage in the document later.
 *
 * Spec: https://developer.chrome.com/docs/ai/prompt-api
 */

const SYSTEM_PROMPT = `You are an automated Terms of Service analyzer.

Read the user-provided ToS text and identify problematic clauses. Return STRICT JSON only, no prose, no markdown fences.

Schema:
{
  "score": number,            // 0 = very fair, 10 = very hostile to users
  "serviceType": "fintech" | "social_media" | "content" | "marketplace" | "general_tech",
  "summary": string,          // one sentence, factual, ≤ 160 chars
  "flags": [
    {
      "id": string,           // snake_case id: mandatory_arbitration, data_third_parties, ai_training_data, etc.
      "severity": "high" | "full" | "partial",
      "title": string,        // ≤ 40 chars, neutral wording
      "quote": string         // verbatim excerpt from the text, 8-200 chars, EXACT substring
    }
  ],
  "credits": [
    { "id": string, "title": string, "note": string }
  ]
}

Rules:
- Use factual, neutral language. Never say "evil", "predatory", "dangerous". Prefer "high-risk", "broad", "unfavourable".
- Every flag MUST include a "quote" that appears verbatim in the input text. If you cannot find an exact quote, omit the flag.
- Maximum 8 flags. Prioritize the worst.
- Output ONLY valid JSON. No commentary.`;

/**
 * @param {{ textForAnalysis: string, [k: string]: any }} input
 * @returns {Promise<{ value: object }>}
 */
export async function analyze(input, _ctx) {
  if (!("LanguageModel" in self)) {
    throw new Error("Chrome Built-in AI is not available on this device");
  }

  const availability = await self.LanguageModel.availability();
  if (availability === "unavailable") {
    throw new Error("Chrome Built-in AI is unavailable on this device");
  }

  const session = await self.LanguageModel.create({
    initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
  });

  let raw;
  try {
    raw = await session.prompt(input.textForAnalysis);
  } finally {
    session.destroy?.();
  }

  const parsed = parseAndValidate(raw);
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

/**
 * Validate the LLM JSON output against the expected schema.
 * Rejects unknown shapes, clamps numbers, drops malformed flags.
 *
 * Closes vulnerability #5 (no schema validation of AI output).
 */
function parseAndValidate(raw) {
  let obj;
  try {
    const trimmed = String(raw)
      .trim()
      .replace(/^```(?:json)?/, "")
      .replace(/```$/, "")
      .trim();
    obj = JSON.parse(trimmed);
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
  const summary = typeof obj.summary === "string" ? obj.summary.slice(0, 200) : "";

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
          title: f.title.slice(0, 80),
          severity: ["high", "full", "partial"].includes(f.severity) ? f.severity : "full",
          quote: f.quote.slice(0, 400),
        }))
        .slice(0, 8)
    : [];

  const credits = Array.isArray(obj.credits)
    ? obj.credits
        .filter((c) => c && typeof c.id === "string" && typeof c.title === "string")
        .map((c) => ({
          id: c.id.slice(0, 60),
          title: c.title.slice(0, 80),
          note: typeof c.note === "string" ? c.note.slice(0, 200) : "",
        }))
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
