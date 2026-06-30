import type { z } from "zod";

/**
 * Options passed through to the underlying SDK adapter.
 */
export type ScopraModelOptions = Record<string, unknown>;

/**
 * Input for text generation through a Scopra model adapter.
 */
export type ScopraTextInput = {
  /** System instructions for the generation request. */
  readonly system: string;
  /** User prompt for the generation request. */
  readonly prompt: string;
  /** Optional cancellation signal. */
  readonly abortSignal?: AbortSignal | undefined;
  /** SDK-specific generation options. */
  readonly modelOptions?: ScopraModelOptions | undefined;
};

/**
 * Input for structured object generation through a Scopra model adapter.
 */
export type ScopraObjectInput = ScopraTextInput & {
  /** Schema the returned object must satisfy. */
  readonly schema: z.ZodType;
  /** Optional schema name for SDKs that support it. */
  readonly schemaName?: string | undefined;
  /** Optional schema description for SDKs that support it. */
  readonly schemaDescription?: string | undefined;
};

/**
 * SDK-neutral model adapter used by Scopra's LLM-backed workflows.
 */
export type ScopraModel = {
  /** Generates text from Scopra-owned instructions and prompt content. */
  readonly generateText: (input: ScopraTextInput) => Promise<string>;
  /** Generates a structured object from Scopra-owned instructions, prompt, and schema. */
  readonly generateObject: (input: ScopraObjectInput) => Promise<unknown>;
};

export function isScopraModel(value: unknown): value is ScopraModel {
  return (
    typeof value === "object" &&
    value !== null &&
    "generateText" in value &&
    typeof value.generateText === "function" &&
    "generateObject" in value &&
    typeof value.generateObject === "function"
  );
}
