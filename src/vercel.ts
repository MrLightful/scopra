import type { ProtecModel } from "./model";

/**
 * Adapts a Vercel AI SDK language model to Protec's SDK-neutral model interface.
 */
export function vercel(model: unknown): ProtecModel {
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
      const { generateObject } = await import("ai");
      const result = await generateObject({
        ...input.modelOptions,
        model,
        instructions: input.system,
        prompt: input.prompt,
        schema: input.schema,
        ...(input.schemaName !== undefined ? { schemaName: input.schemaName } : {}),
        ...(input.schemaDescription !== undefined
          ? { schemaDescription: input.schemaDescription }
          : {}),
        ...(input.abortSignal !== undefined ? { abortSignal: input.abortSignal } : {}),
      } as Parameters<typeof generateObject>[0]);

      return result.object;
    },
  };
}
