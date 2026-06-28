import type { z } from "zod";

/**
 * Options passed through to the underlying SDK adapter.
 */
export type ProtecModelOptions = Record<string, unknown>;

/**
 * Input for text generation through a Protec model adapter.
 */
export type ProtecTextInput = {
  /** System instructions for the generation request. */
  readonly system: string;
  /** User prompt for the generation request. */
  readonly prompt: string;
  /** Optional cancellation signal. */
  readonly abortSignal?: AbortSignal | undefined;
  /** SDK-specific generation options. */
  readonly modelOptions?: ProtecModelOptions | undefined;
};

/**
 * Input for structured object generation through a Protec model adapter.
 */
export type ProtecObjectInput = ProtecTextInput & {
  /** Schema the returned object must satisfy. */
  readonly schema: z.ZodType;
  /** Optional schema name for SDKs that support it. */
  readonly schemaName?: string | undefined;
  /** Optional schema description for SDKs that support it. */
  readonly schemaDescription?: string | undefined;
};

/**
 * SDK-neutral model adapter used by Protec's LLM-backed workflows.
 */
export type ProtecModel = {
  /** Generates text from Protec-owned instructions and prompt content. */
  readonly generateText: (input: ProtecTextInput) => Promise<string>;
  /** Generates a structured object from Protec-owned instructions, prompt, and schema. */
  readonly generateObject: (input: ProtecObjectInput) => Promise<unknown>;
};

export function isProtecModel(value: unknown): value is ProtecModel {
  return (
    typeof value === "object" &&
    value !== null &&
    "generateText" in value &&
    typeof value.generateText === "function" &&
    "generateObject" in value &&
    typeof value.generateObject === "function"
  );
}
