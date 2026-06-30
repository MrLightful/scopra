import type OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { z } from "zod";
import type { ScopraModel, ScopraObjectInput } from "./model";

/**
 * Adapts the official OpenAI SDK to Scopra's SDK-neutral model interface.
 */
export function openai(client: OpenAI, model: string): ScopraModel {
  return {
    async generateText(input) {
      const result = await client.responses.create(
        {
          ...input.modelOptions,
          model,
          instructions: input.system,
          input: input.prompt,
        } as ResponseCreateParamsNonStreaming,
        requestOptions(input.abortSignal),
      );

      return result.output_text;
    },
    async generateObject(input) {
      const result = await client.responses.create(
        {
          ...input.modelOptions,
          model,
          instructions: input.system,
          input: input.prompt,
          text: {
            format: {
              type: "json_schema",
              name: input.schemaName ?? "ScopraObject",
              schema: toJsonSchema(input),
              ...(input.schemaDescription !== undefined
                ? { description: input.schemaDescription }
                : {}),
              strict: true,
            },
          },
        } as ResponseCreateParamsNonStreaming,
        requestOptions(input.abortSignal),
      );

      return input.schema.parse(JSON.parse(result.output_text));
    },
  };
}

function requestOptions(signal: AbortSignal | undefined): { signal?: AbortSignal } | undefined {
  return signal === undefined ? undefined : { signal };
}

function toJsonSchema(input: ScopraObjectInput): Record<string, unknown> {
  return z.toJSONSchema(input.schema) as Record<string, unknown>;
}
