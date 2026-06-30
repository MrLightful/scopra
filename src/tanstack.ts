import type { ScopraModel } from "./model";

/**
 * Adapts a TanStack AI text adapter to Scopra's SDK-neutral model interface.
 */
export function tanstack(adapter: unknown): ScopraModel {
  return {
    async generateText(input) {
      const { chat } = await import("@tanstack/ai");
      const result = await chat({
        adapter,
        systemPrompts: [input.system],
        messages: buildMessages(input.prompt),
        stream: false,
        modelOptions: input.modelOptions,
        abortController: toAbortController(input.abortSignal),
      } as unknown as Parameters<typeof chat>[0]);

      return String(result);
    },
    async generateObject(input) {
      const { chat } = await import("@tanstack/ai");
      return chat({
        adapter,
        systemPrompts: [input.system],
        messages: buildMessages(input.prompt),
        outputSchema: input.schema,
        modelOptions: input.modelOptions,
        abortController: toAbortController(input.abortSignal),
      } as unknown as Parameters<typeof chat>[0]);
    },
  };
}

function buildMessages(prompt: string): unknown[] {
  return [
    {
      role: "user",
      content: prompt,
    },
  ];
}

function toAbortController(signal: AbortSignal | undefined): AbortController | undefined {
  if (signal === undefined) {
    return undefined;
  }

  const controller = new AbortController();

  if (signal.aborted) {
    controller.abort(signal.reason);
    return controller;
  }

  signal.addEventListener("abort", () => controller.abort(signal.reason), {
    once: true,
  });

  return controller;
}
