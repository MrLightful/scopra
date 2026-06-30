import { describe, expect, test } from "bun:test";
import type { AnyTextAdapter } from "@tanstack/ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { tanstack } from "./tanstack";
import { vercel } from "./vercel";

type CallRecord = Record<string, unknown>;
type StructuredOutputCall = {
  readonly chatOptions: {
    readonly request?: RequestInit;
  } & Record<string, unknown>;
  readonly outputSchema: Record<string, unknown>;
} & Record<string, unknown>;

describe("vercel", () => {
  test("forwards text generation inputs to the Vercel AI SDK", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: createTextGeneration("Hello from Vercel."),
    });
    const adapter = vercel(model);

    const text = await adapter.generateText({
      system: "Speak plainly.",
      prompt: "Say hello.",
      modelOptions: {
        temperature: 0,
      },
    });

    expect(text).toBe("Hello from Vercel.");
    expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain("Speak plainly.");
    expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain("Say hello.");
    expect(model.doGenerateCalls[0]?.temperature).toBe(0);
  });

  test("forwards object generation inputs to the Vercel AI SDK", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: createTextGeneration('{"value":"ok"}'),
    });
    const adapter = vercel(model);

    const object = await adapter.generateObject({
      system: "Return JSON.",
      prompt: "Return a value.",
      schema: z.object({
        value: z.string(),
      }),
      schemaName: "TestObject",
      schemaDescription: "A test object.",
      modelOptions: {
        temperature: 0,
      },
    });

    expect(object).toEqual({
      value: "ok",
    });
    expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain("Return JSON.");
    expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain("Return a value.");
    expect(model.doGenerateCalls[0]?.temperature).toBe(0);
  });
});

describe("tanstack", () => {
  test("forwards text generation inputs to TanStack AI chat", async () => {
    const { adapter, chatStreamCalls } = createTanstackAdapter({
      text: "Hello from TanStack.",
    });
    const model = tanstack(adapter);

    const text = await model.generateText({
      system: "Speak plainly.",
      prompt: "Say hello.",
      modelOptions: {
        temperature: 0,
      },
    });

    expect(text).toBe("Hello from TanStack.");
    expect(chatStreamCalls[0]).toMatchObject({
      model: "test-model",
      modelOptions: {
        temperature: 0,
      },
      messages: [
        {
          role: "user",
          content: "Say hello.",
        },
      ],
      systemPrompts: ["Speak plainly."],
    });
  });

  test("forwards structured generation inputs to TanStack AI chat", async () => {
    const { adapter, structuredOutputCalls } = createTanstackAdapter({
      object: {
        value: "ok",
      },
    });
    const model = tanstack(adapter);
    const abortController = new AbortController();

    const object = await model.generateObject({
      system: "Return JSON.",
      prompt: "Return a value.",
      schema: z.object({
        value: z.string(),
      }),
      abortSignal: abortController.signal,
      modelOptions: {
        temperature: 0,
      },
    });

    expect(object).toEqual({
      value: "ok",
    });
    expect(structuredOutputCalls[0]?.chatOptions).toMatchObject({
      model: "test-model",
      modelOptions: {
        temperature: 0,
      },
      messages: [
        {
          role: "user",
          content: "Return a value.",
        },
      ],
      systemPrompts: ["Return JSON."],
    });
    expect(structuredOutputCalls[0]?.chatOptions.request).toMatchObject({
      signal: expect.any(AbortSignal),
    });
    expect(structuredOutputCalls[0]?.outputSchema).toMatchObject({
      type: "object",
    });
  });

  test("handles already-aborted signals before TanStack AI chat completes", async () => {
    const { adapter, structuredOutputCalls } = createTanstackAdapter({
      object: {
        value: "ok",
      },
    });
    const model = tanstack(adapter);
    const abortController = new AbortController();
    abortController.abort("already aborted");

    await expect(
      model.generateObject({
        system: "Return JSON.",
        prompt: "Return a value.",
        schema: z.object({
          value: z.string(),
        }),
        abortSignal: abortController.signal,
      }),
    ).rejects.toThrow("structured output finalization produced no result");

    expect(structuredOutputCalls).toHaveLength(0);
  });
});

function createTextGeneration(text: string) {
  return async () => ({
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
    finishReason: {
      unified: "stop" as const,
      raw: undefined,
    },
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 20,
        text: 20,
        reasoning: undefined,
      },
    },
    warnings: [],
  });
}

type TanstackAdapterOptions = {
  readonly text?: string;
  readonly object?: unknown;
};

function createTanstackAdapter(options: TanstackAdapterOptions): {
  readonly adapter: AnyTextAdapter;
  readonly chatStreamCalls: CallRecord[];
  readonly structuredOutputCalls: StructuredOutputCall[];
} {
  const chatStreamCalls: CallRecord[] = [];
  const structuredOutputCalls: StructuredOutputCall[] = [];

  const adapter = {
    kind: "text",
    name: "test",
    model: "test-model",
    async *chatStream(call: CallRecord) {
      chatStreamCalls.push(call);

      yield {
        type: "RUN_STARTED",
        runId: "run-1",
        threadId: "thread-1",
        model: "test-model",
        timestamp: Date.now(),
      };
      yield {
        type: "TEXT_MESSAGE_START",
        messageId: "message-1",
        role: "assistant",
        model: "test-model",
        timestamp: Date.now(),
      };
      yield {
        type: "TEXT_MESSAGE_CONTENT",
        messageId: "message-1",
        delta: options.text ?? "",
        model: "test-model",
        timestamp: Date.now(),
      };
      yield {
        type: "TEXT_MESSAGE_END",
        messageId: "message-1",
        model: "test-model",
        timestamp: Date.now(),
      };
      yield {
        type: "RUN_FINISHED",
        runId: "run-1",
        threadId: "thread-1",
        model: "test-model",
        timestamp: Date.now(),
      };
    },
    async structuredOutput(call: StructuredOutputCall) {
      structuredOutputCalls.push(call);

      return {
        data: options.object,
        rawText: JSON.stringify(options.object),
      };
    },
  } as unknown as AnyTextAdapter;

  return {
    adapter,
    chatStreamCalls,
    structuredOutputCalls,
  };
}
