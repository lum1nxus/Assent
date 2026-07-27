import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAP,
  LM_OPTIONS,
  mapAvailability,
  checkCapability,
  isReady,
  needsDownload,
} from "../extension/src/features/capability.js";

function mockScope(availability, { throws = false } = {}) {
  const calls = [];
  return {
    calls,
    scope: {
      LanguageModel: {
        availability: async (options) => {
          calls.push(options);
          if (throws) {
            throw new Error("boom");
          }
          return availability;
        },
      },
    },
  };
}

test("no LanguageModel in scope → unsupported_browser", async () => {
  const result = await checkCapability({});
  assert.equal(result.state, CAP.UNSUPPORTED_BROWSER);
});

test("scope without availability function → unsupported_browser", async () => {
  const result = await checkCapability({ LanguageModel: {} });
  assert.equal(result.state, CAP.UNSUPPORTED_BROWSER);
});

test("availability 'available' → ready", async () => {
  const { scope } = mockScope("available");
  const result = await checkCapability(scope);
  assert.equal(result.state, CAP.READY);
});

test("availability 'downloadable' → downloadable", async () => {
  const { scope } = mockScope("downloadable");
  const result = await checkCapability(scope);
  assert.equal(result.state, CAP.DOWNLOADABLE);
});

test("availability 'downloading' → downloading", async () => {
  const { scope } = mockScope("downloading");
  const result = await checkCapability(scope);
  assert.equal(result.state, CAP.DOWNLOADING);
});

test("availability 'unavailable' → unavailable_hardware", async () => {
  const { scope } = mockScope("unavailable");
  const result = await checkCapability(scope);
  assert.equal(result.state, CAP.UNAVAILABLE_HARDWARE);
});

test("unknown availability value → unavailable_hardware", async () => {
  const { scope } = mockScope("weird-value");
  const result = await checkCapability(scope);
  assert.equal(result.state, CAP.UNAVAILABLE_HARDWARE);
});

test("availability throwing → unsupported_browser with error", async () => {
  const { scope } = mockScope(null, { throws: true });
  const result = await checkCapability(scope);
  assert.equal(result.state, CAP.UNSUPPORTED_BROWSER);
  assert.ok(result.error);
});

test("checkCapability passes expectedInputs/expectedOutputs to availability", async () => {
  const { scope, calls } = mockScope("available");
  await checkCapability(scope);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], LM_OPTIONS);
  assert.deepEqual(calls[0].expectedInputs, [{ type: "text", languages: ["en"] }]);
  assert.deepEqual(calls[0].expectedOutputs, [{ type: "text", languages: ["en"] }]);
});

test("mapAvailability maps every documented state", () => {
  assert.equal(mapAvailability("available"), CAP.READY);
  assert.equal(mapAvailability("downloadable"), CAP.DOWNLOADABLE);
  assert.equal(mapAvailability("downloading"), CAP.DOWNLOADING);
  assert.equal(mapAvailability("unavailable"), CAP.UNAVAILABLE_HARDWARE);
  assert.equal(mapAvailability(undefined), CAP.UNAVAILABLE_HARDWARE);
});

test("isReady / needsDownload helpers", () => {
  assert.equal(isReady(CAP.READY), true);
  assert.equal(isReady(CAP.DOWNLOADABLE), false);
  assert.equal(needsDownload(CAP.DOWNLOADABLE), true);
  assert.equal(needsDownload(CAP.DOWNLOADING), true);
  assert.equal(needsDownload(CAP.READY), false);
});
