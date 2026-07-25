import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAndValidate } from "../extension/src/pipeline/steps/analyze.js";

const docText =
  "The service may terminate this agreement at any time with or without notice for any reason including but not limited to inactivity or breach of these terms by the account holder.";

test("parseAndValidate accepts a verbatim contiguous quote", () => {
  const raw = JSON.stringify({
    serviceType: "general_tech",
    flags: [
      {
        category: "account_termination_no_notice",
        severity: "high",
        quote:
          "The service may terminate this agreement at any time with or without notice for any reason",
      },
    ],
    credits: [],
  });
  const parsed = parseAndValidate(raw, docText);
  assert.equal(parsed.flags.length, 1);
});

test("parseAndValidate rejects a head+tail spliced quote", () => {
  const raw = JSON.stringify({
    serviceType: "general_tech",
    flags: [
      {
        category: "account_termination_no_notice",
        severity: "high",
        quote:
          "The service may terminate this agreement at any time WHATEVER MIDDLE MADE UP TEXT breach of these terms by the account holder.",
      },
    ],
    credits: [],
  });
  const parsed = parseAndValidate(raw, docText);
  assert.equal(
    parsed.flags.length,
    0,
    "head+tail splice must be rejected; head and tail alone are not enough",
  );
});

test("parseAndValidate rejects a quote that is not in the document", () => {
  const raw = JSON.stringify({
    serviceType: "general_tech",
    flags: [
      {
        category: "mandatory_arbitration",
        severity: "high",
        quote: "Any dispute shall be resolved by binding arbitration in accordance with the rules",
      },
    ],
    credits: [],
  });
  const parsed = parseAndValidate(raw, docText);
  assert.equal(parsed.flags.length, 0, "fabricated quote must be rejected");
});

test("parseAndValidate treats smart quotes and em-dashes equivalently to ASCII", () => {
  const doc =
    'You waive class action rights - "final and binding" - to the extent permitted by law.';
  const raw = JSON.stringify({
    serviceType: "general_tech",
    flags: [
      {
        category: "class_action_waiver",
        severity: "high",
        quote:
          "You waive class action rights \u2014 \u201Cfinal and binding\u201D \u2014 to the extent permitted by law.",
      },
    ],
    credits: [],
  });
  const parsed = parseAndValidate(raw, doc);
  assert.equal(
    parsed.flags.length,
    1,
    "smart-quote/dash normalisation should let a matching quote through",
  );
});
