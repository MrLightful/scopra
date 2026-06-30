import type { ScopraModel } from "./model";

/**
 * Adapts a Vercel AI SDK language model to Scopra's SDK-neutral model interface.
 */
export function vercel(model: unknown): ScopraModel {
  return {
    async generateText(input) {
      const { generateText } = await import("ai");
      const result = await generateText({
        ...input.modelOptions,
        model,
        instructions: input.system,
        prompt: input.prompt,
        ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
      } as Parameters<typeof generateText>[0]);

      return result.text;
    },
    async generateObject(input) {
      const { generateText, Output } = await import("ai");
      const result = await generateText({
        ...input.modelOptions,
        model,
        instructions: input.system,
        prompt: input.prompt,
        output: Output.object({
          schema: input.schema,
          ...(input.schemaName !== undefined ? { name: input.schemaName } : {}),
          ...(input.schemaDescription !== undefined
            ? { description: input.schemaDescription }
            : {}),
        }),
        ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
      } as Parameters<typeof generateText>[0]);

      return result.output;
    },
  };
}
