import type Anthropic from "@anthropic-ai/sdk";
import type {
  MessageCreateParamsNonStreaming,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages";
import { z } from "zod";
import type { ScopraModel, ScopraModelOptions, ScopraObjectInput } from "./model";

const DEFAULT_MAX_TOKENS = 4096;
const STRUCTURED_TOOL_NAME = "scopra_generate_object";

/**
 * Options for Scopra's official Anthropic SDK adapter.
 */
export type AnthropicAdapterOptions = {
  /** Default max tokens when model options do not provide max_tokens. */
  readonly maxTokens?: number | undefined;
};

/**
 * Adapts the official Anthropic SDK to Scopra's SDK-neutral model interface.
 */
export function anthropic(
  client: Anthropic,
  model: string,
  options: AnthropicAdapterOptions = {},
): ScopraModel {
  return {
    async generateText(input) {
      const result = await client.messages.create(
        {
          ...input.modelOptions,
          model,
          max_tokens: maxTokens(input.modelOptions, options),
          system: input.system,
          messages: [
            {
              role: "user",
              content: input.prompt,
            },
          ],
        } as MessageCreateParamsNonStreaming,
        requestOptions(input.abortSignal),
      );

      return result.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    },
    async generateObject(input) {
      const result = await client.messages.create(
        {
          ...input.modelOptions,
          model,
          max_tokens: maxTokens(input.modelOptions, options),
          system: input.system,
          messages: [
            {
              role: "user",
              content: input.prompt,
            },
          ],
          tools: [
            {
              name: STRUCTURED_TOOL_NAME,
              description:
                input.schemaDescription ??
                "Return the requested structured object for this Scopra generation request.",
              input_schema: toJsonSchema(input),
            },
          ],
          tool_choice: {
            type: "tool",
            name: STRUCTURED_TOOL_NAME,
            disable_parallel_tool_use: true,
          },
        } as MessageCreateParamsNonStreaming,
        requestOptions(input.abortSignal),
      );
      const toolUse = result.content.find(isStructuredToolUse);

      if (toolUse === undefined) {
        throw new Error("Anthropic model did not return the expected structured output tool call.");
      }

      return input.schema.parse(toolUse.input);
    },
  };
}

function requestOptions(signal: AbortSignal | undefined): { signal?: AbortSignal } | undefined {
  return signal === undefined ? undefined : { signal };
}

function maxTokens(
  modelOptions: ScopraModelOptions | undefined,
  options: AnthropicAdapterOptions,
): number {
  const configured = modelOptions?.max_tokens;

  return typeof configured === "number" ? configured : (options.maxTokens ?? DEFAULT_MAX_TOKENS);
}

function toJsonSchema(input: ScopraObjectInput): Record<string, unknown> {
  return z.toJSONSchema(input.schema) as Record<string, unknown>;
}

function isStructuredToolUse(block: unknown): block is ToolUseBlock {
  return (
    typeof block === "object" &&
    block !== null &&
    "type" in block &&
    block.type === "tool_use" &&
    "name" in block &&
    block.name === STRUCTURED_TOOL_NAME
  );
}
