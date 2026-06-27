# protec

Developer-first TypeScript policy enforcement for AI applications.

Protec sits alongside your model and evaluates user inputs, model outputs, and tool
invocations before the workflow continues.

## Install

```sh
bun add protec
```

Install the AI SDK provider you want to use with the LLM evaluator:

```sh
bun add @ai-sdk/openai
```

## Usage

```ts
import { openai } from "@ai-sdk/openai";
import { Policy, PolicyPipeline, deny, llm } from "protec";

const noSecrets = new Policy({
  id: "no-secrets",
  name: "No secrets",
  description: "Prevents sensitive data exposure.",
  instruction: "Block exposed API keys and secrets.",
  action: deny("Do not share secrets.", {
    // Deny only when the failed finding has confidence >= 0.95.
    confidence: 0.95,
  }),
});

const pipeline = new PolicyPipeline({
  policies: [noSecrets],
  evaluator: llm(openai("gpt-4.1")),
});

const decision = await pipeline.evaluate({
  type: "output",
  content: "Here is the answer.",
});

if (!decision.allowed) {
  console.log(decision.message);
}
```

You can also bring your own evaluator, such as a rules engine, internal service,
or test double:

```ts
const pipeline = new PolicyPipeline({
  policies: [noSecrets],
  evaluator: async ({ request, policies }) =>
    policies.map((policy) => ({
      policyId: policy.id,
      passed: request.type !== "output" || !request.content.includes("sk_live_"),
      reason: "Checked output for exposed API keys.",
      confidence: 0.95,
    })),
});
```

## Evaluation Requests

```ts
await pipeline.evaluate({
  type: "input",
  content: "Can you help me write a test?",
});

await pipeline.evaluate({
  type: "output",
  content: "Here is a safe response.",
});

await pipeline.evaluate({
  type: "tool",
  name: "sendEmail",
  arguments: {
    to: "security@example.com",
    subject: "Review needed",
  },
});
```

## Development

```sh
bun install
bun test
bun run check
bun run build
```

## Publishing

```sh
npm publish
```
