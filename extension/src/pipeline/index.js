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
