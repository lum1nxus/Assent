/**
 * Pipeline orchestrator (chain of responsibility).
 *
 * Each step is a pure async function: `(input, ctx) => { value, done? }`
 * - If `done: true` is returned, pipeline short-circuits and returns `value` immediately.
 * - If a step throws, the orchestrator wraps the error with the step name for debugging.
 *
 * Context (`ctx`) carries: tabId, jurisdiction, userLanguage, abortSignal, onProgress.
 */

/**
 * @typedef {object} StepResult
 * @property {*} value           Forwarded value or final result
 * @property {boolean} [done]    If true, short-circuits the pipeline
 *
 * @typedef {object} Step
 * @property {string} name
 * @property {(input: *, ctx: object) => Promise<StepResult>} fn
 */

/**
 * Run a pipeline of async steps. Throws on first step error.
 *
 * @param {Step[]} steps
 * @param {*} initialInput
 * @param {object} ctx
 * @returns {Promise<*>} Final value after the last step (or earlier on short-circuit)
 */
export async function run(steps, initialInput, ctx) {
  let value = initialInput;

  for (const step of steps) {
    if (ctx.abortSignal?.aborted) {
      throw new DOMException("Pipeline aborted", "AbortError");
    }
    ctx.onProgress?.(step.name);

    try {
      const result = await step.fn(value, ctx);
      if (result?.done) {
        return result.value;
      }
      value = result?.value ?? value;
    } catch (err) {
      const wrapped = new Error(`step "${step.name}" failed: ${err.message}`);
      wrapped.cause = err;
      wrapped.step = step.name;
      throw wrapped;
    }
  }

  return value;
}
