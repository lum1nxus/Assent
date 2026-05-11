# AI-output replay fixtures

Each `*.json` file in this folder is a single test case for the analysis pipeline. The format is:

```json
{
  "name": "human-readable fixture id",
  "description": "what this fixture exercises",
  "documentText": "the text that was fed to the on-device model",
  "rawAiResponse": "the verbatim string the model returned",
  "expectedFlags": [{ "category": "...", "severity": "..." }],
  "expectedCredits": [{ "category": "..." }],
  "expectedReason": "why we expect the result shown above"
}
```

`tests/analyze-pipeline.test.js` loads every fixture and calls `parseAndValidate(rawAiResponse, documentText)`. The categories and severities in `expectedFlags` must match the survivors of every guard in the pipeline; the same goes for credits.

Two kinds of fixtures live here:

- `regression-*.json` - captured from a real bug we want to never see again. Each one pins a specific guard behaviour: negation, splice rejection, keyword mismatch, hallucinated category, missing quote, JSON sanitisation.
- `happy-*.json` - well-formed, representative AI outputs. They confirm that the pipeline does not over-filter legitimate classifications.

When a new failure mode shows up in Chrome:

1. In the side-panel DevTools, run the capture snippet in `scripts/capture.md`.
2. Save the dumped object as a new `regression-*.json` next to these files.
3. Set `expectedFlags` and `expectedCredits` to the correct post-guard output, even if the captured `rawAiResponse` would currently produce something else.
4. Run `npm test`. The new test will fail until the underlying guard or prompt is fixed; the fix lands together with the fixture.
