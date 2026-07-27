import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureModelDownloaded } from "../extension/src/features/model-download.js";

function mockScope({ progressValues = [], throwOnCreate = false } = {}) {
  let destroyed = false;
  const createOptions = [];
  const scope = {
    LanguageModel: {
      create: async (options) => {
        createOptions.push(options);
        if (throwOnCreate) {
          throw new Error("create failed");
        }
        const listeners = [];
        const monitor = {
          addEventListener: (type, cb) => {
            if (type === "downloadprogress") {
              listeners.push(cb);
            }
          },
        };
        options.monitor?.(monitor);
        for (const value of progressValues) {
          for (const cb of listeners) {
            cb({ loaded: value });
          }
        }
        return {
          destroy: () => {
            destroyed = true;
          },
        };
      },
    },
  };
  return { scope, createOptions, wasDestroyed: () => destroyed };
}

test("throws when LanguageModel is not available", async () => {
  await assert.rejects(() => ensureModelDownloaded({ scope: {} }), /not available/);
});

test("passes expectedInputs/expectedOutputs to create", async () => {
  const { scope, createOptions } = mockScope();
  await ensureModelDownloaded({ scope });
  assert.deepEqual(createOptions[0].expectedInputs, [{ type: "text", languages: ["en"] }]);
  assert.deepEqual(createOptions[0].expectedOutputs, [{ type: "text", languages: ["en"] }]);
});

test("reports download progress and clamps values", async () => {
  const { scope } = mockScope({ progressValues: [0, 0.5, 1.4] });
  const seen = [];
  await ensureModelDownloaded({ scope, onProgress: (f) => seen.push(f) });
  assert.deepEqual(seen, [0, 0.5, 1, 1]);
});

test("destroys the probing session and resolves true", async () => {
  const { scope, wasDestroyed } = mockScope();
  const result = await ensureModelDownloaded({ scope });
  assert.equal(result, true);
  assert.equal(wasDestroyed(), true);
});

test("propagates create() failure", async () => {
  const { scope } = mockScope({ throwOnCreate: true });
  await assert.rejects(() => ensureModelDownloaded({ scope }), /create failed/);
});
