import { describe, expect, test } from "bun:test";
import type Anthropic from "@anthropic-ai/sdk";
import type { AnyTextAdapter } from "@tanstack/ai";
import { MockLanguageModelV4 } from "ai/test";
import type OpenAI from "openai";
import { z } from "zod";
import { anthropic } from "./anthropic";
import { openai } from "./openai";
import { tanstack } from "./tanstack";
import { vercel } from "./vercel";

type CallRecord = Record<string, unknown>;
type StructuredOutputCall = {
  readonly chatOptions: {
    readonly request?: RequestInit;
  } & Record<string, unknown>;
  readonly outputSchema: Record<string, unknown>;
} & Record<string, unknown>;

describe("openai", () => {
  test("forwards text generation inputs to the OpenAI SDK", async () => {
    const { client, calls } = createOpenAIClient("Hello from OpenAI.");
    const model = openai(client, "gpt-test");
    const abortController = new AbortController();

    const text = await model.generateText({
      system: "Speak plainly.",
      prompt: "Say hello.",
      abortSignal: abortController.signal,
      modelOptions: {
        model: "ignored-model",
        instructions: "Ignored instructions.",
        input: "Ignored prompt.",
        temperature: 0,
      },
    });

    expect(text).toBe("Hello from OpenAI.");
    expect(calls[0]?.params).toMatchObject({
      model: "gpt-test",
      instructions: "Speak plainly.",
      input: "Say hello.",
      temperature: 0,
    });
    expect(calls[0]?.options).toEqual({
      signal: abortController.signal,
    });
  });

  test("forwards object generation inputs to the OpenAI SDK", async () => {
    const { client, calls } = createOpenAIClient('{"value":"ok"}');
    const model = openai(client, "gpt-test");

    const object = await model.generateObject({
      system: "Return JSON.",
      prompt: "Return a value.",
      schema: z.object({
        value: z.string(),
      }),
      schemaName: "TestObject",
      schemaDescription: "A test object.",
      modelOptions: {
        text: {
          format: {
            type: "text",
          },
        },
        temperature: 0,
      },
    });

    expect(object).toEqual({
      value: "ok",
    });
    expect(calls[0]?.params).toMatchObject({
      model: "gpt-test",
      instructions: "Return JSON.",
      input: "Return a value.",
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "TestObject",
          description: "A test object.",
          strict: true,
          schema: {
            type: "object",
          },
        },
      },
    });
  });
});

describe("anthropic", () => {
  test("forwards text generation inputs to the Anthropic SDK", async () => {
    const { client, calls } = createAnthropicClient([
      {
        type: "text",
        text: "Hello from Anthropic.",
      },
    ]);
    const model = anthropic(client, "claude-test");
    const abortController = new AbortController();

    const text = await model.generateText({
      system: "Speak plainly.",
      prompt: "Say hello.",
      abortSignal: abortController.signal,
      modelOptions: {
        model: "ignored-model",
        max_tokens: 256,
        messages: [],
        temperature: 0,
      },
    });

    expect(text).toBe("Hello from Anthropic.");
    expect(calls[0]?.params).toMatchObject({
      model: "claude-test",
      max_tokens: 256,
      system: "Speak plainly.",
      messages: [
        {
          role: "user",
          content: "Say hello.",
        },
      ],
      temperature: 0,
    });
    expect(calls[0]?.options).toEqual({
      signal: abortController.signal,
    });
  });

  test("uses the default Anthropic max token limit", async () => {
    const { client, calls } = createAnthropicClient([]);
    const model = anthropic(client, "claude-test");

    await model.generateText({
      system: "Speak plainly.",
      prompt: "Say hello.",
    });

    expect(calls[0]?.params.max_tokens).toBe(4096);
  });

  test("forwards object generation inputs to the Anthropic SDK", async () => {
    const { client, calls } = createAnthropicClient([
      {
        type: "tool_use",
        name: "scopra_generate_object",
        input: {
          value: "ok",
        },
      },
    ]);
    const model = anthropic(client, "claude-test");

    const object = await model.generateObject({
      system: "Return JSON.",
      prompt: "Return a value.",
      schema: z.object({
        value: z.string(),
      }),
      schemaDescription: "A test object.",
      modelOptions: {
        tool_choice: {
          type: "none",
        },
        tools: [],
        max_tokens: 512,
      },
    });

    expect(object).toEqual({
      value: "ok",
    });
    expect(calls[0]?.params).toMatchObject({
      model: "claude-test",
      max_tokens: 512,
      system: "Return JSON.",
      messages: [
        {
          role: "user",
          content: "Return a value.",
        },
      ],
      tools: [
        {
          name: "scopra_generate_object",
          description: "A test object.",
          input_schema: {
            type: "object",
          },
        },
      ],
      tool_choice: {
        type: "tool",
        name: "scopra_generate_object",
        disable_parallel_tool_use: true,
      },
    });
  });

  test("rejects Anthropic structured generation without the expected tool call", async () => {
    const { client } = createAnthropicClient([
      {
        type: "text",
        text: "No tool call.",
      },
    ]);
    const model = anthropic(client, "claude-test");

    await expect(
      model.generateObject({
        system: "Return JSON.",
        prompt: "Return a value.",
        schema: z.object({
          value: z.string(),
        }),
      }),
    ).rejects.toThrow("expected structured output tool call");
  });
});

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

function createOpenAIClient(text: string): {
  readonly client: OpenAI;
  readonly calls: {
    readonly params: Record<string, unknown>;
    readonly options: Record<string, unknown> | undefined;
  }[];
} {
  const calls: {
    readonly params: Record<string, unknown>;
    readonly options: Record<string, unknown> | undefined;
  }[] = [];
  const client = {
    responses: {
      async create(params: Record<string, unknown>, options?: Record<string, unknown>) {
        calls.push({ params, options });

        return {
          output_text: text,
        };
      },
    },
  } as unknown as OpenAI;

  return {
    client,
    calls,
  };
}

function createAnthropicClient(content: unknown[]): {
  readonly client: Anthropic;
  readonly calls: {
    readonly params: Record<string, unknown>;
    readonly options: Record<string, unknown> | undefined;
  }[];
} {
  const calls: {
    readonly params: Record<string, unknown>;
    readonly options: Record<string, unknown> | undefined;
  }[] = [];
  const client = {
    messages: {
      async create(params: Record<string, unknown>, options?: Record<string, unknown>) {
        calls.push({ params, options });

        return {
          content,
        };
      },
    },
  } as unknown as Anthropic;

  return {
    client,
    calls,
  };
}

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
