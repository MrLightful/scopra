# protec

Developer-first TypeScript policy enforcement for AI applications.

Protec sits alongside your model and evaluates user inputs, model outputs, and tool
invocations before the workflow continues.

## Install

```sh
bun add protec
```

## Usage

```ts
import { allow, Policy, PolicyEngine, deny } from "protec";

const noSecrets = new Policy({
  id: "no-secrets",
  name: "No secrets",
  description: "Prevents sensitive data exposure.",
  instruction: "Block exposed API keys and secrets.",
  action: deny("Do not share secrets."),
});

const approvedTool = new Policy({
  id: "approved-tool",
  name: "Approved tool",
  description: "Marks approved tool usage.",
  instruction: "Allow approved tool invocations.",
  action: allow(),
});

const engine = new PolicyEngine({
  policies: [noSecrets, approvedTool],
  evaluator: async ({ request, policies }) => {
    // Bring your own evaluator: an LLM, rules engine, internal service, or test double.
    return policies.map((policy) => ({
      policyId: policy.id,
      passed: request.type !== "output" || !request.content.includes("sk_live_"),
      reason: "Checked output for exposed API keys.",
      confidence: 0.95,
    }));
  },
});

const decision = await engine.evaluate({
  type: "output",
  content: "Here is the answer.",
});

if (!decision.allowed) {
  console.log(decision.message);
}
```

## Evaluation Requests

```ts
await engine.evaluate({
  type: "input",
  content: "Can you help me write a test?",
});

await engine.evaluate({
  type: "output",
  content: "Here is a safe response.",
});

await engine.evaluate({
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
