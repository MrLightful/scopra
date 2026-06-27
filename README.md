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
import { AgentScopePolicy, NoSecretsPolicy, PolicyPipeline, llm } from "protec";

const pipeline = new PolicyPipeline({
  policies: [
    new NoSecretsPolicy({
      // Deny only when the failed finding has confidence >= 0.95.
      confidence: 0.95,
    }),
    new AgentScopePolicy({
      scope: "Customer support for Acme billing only.",
      message: "That request is outside support scope.",
    }),
  ],
  evaluator: llm(openai("gpt-4.1")),
});
```

Common policies are regular `Policy` instances, so they work anywhere a policy is
accepted:

```ts
import { openai } from "@ai-sdk/openai";
import {
  AgentScopePolicy,
  NoSecretsPolicy,
  PersonalDataPolicy,
  PolicyPipeline,
  PromptInjectionPolicy,
  UnsafeToolUsePolicy,
  llm,
} from "protec";

const pipeline = new PolicyPipeline({
  policies: [
    new NoSecretsPolicy(),
    new PersonalDataPolicy(),
    new PromptInjectionPolicy(),
    new UnsafeToolUsePolicy(),
    new AgentScopePolicy({
      scope: "Customer support for Acme billing only.",
    }),
  ],
  evaluator: llm(openai("gpt-4.1")),
});
```

Pass a custom `action` when a common policy should escalate or route by
confidence instead of using its default deny action.

```ts
import { NoSecretsPolicy, deny } from "protec";

const noSecrets = new NoSecretsPolicy({
  action: deny("Custom secret warning.", {
    confidence: 0.95,
  }),
});
```

You can also define policies directly:

```ts
import { openai } from "@ai-sdk/openai";
import { Policy, PolicyPipeline, deny, llm } from "protec";

const noSecrets = new Policy({
  id: "no-secrets",
  name: "No secrets",
  description: "Prevents sensitive data exposure.",
  instruction: "Block exposed API keys and secrets.",
  action: deny("Do not share secrets.", {
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

Policies can also escalate uncertain findings to more detailed policies. Use
`policy` for one nested policy or `policies` when a second pass should check
multiple rules:

```ts
const productionSecrets = {
  id: "production-secrets",
  name: "Production secrets",
  instruction: "Block exposed production API keys and credentials.",
  action: deny("Do not share production secrets."),
};

const possibleSecrets = new Policy({
  id: "possible-secrets",
  name: "Possible secrets",
  instruction: "Escalate possible secrets for detailed review.",
  action: escalate({
    policy: productionSecrets,
    // Escalate only when the failed finding has confidence >= 0.4.
    confidence: 0.4,
  }),
});

const pipeline = new PolicyPipeline({
  policies: [possibleSecrets],
  evaluator: llm(openai("gpt-4.1")),
});

const decision = await pipeline.evaluate({
  type: "output",
  content: "Here is the answer.",
});

console.log(decision.escalations);
```

For a broader second pass, pass multiple nested policies:

```ts
const possibleProblem = new Policy({
  id: "possible-problem",
  name: "Possible problem",
  instruction: "Escalate possible problems for detailed review.",
  action: escalate({
    policies: [productionSecrets, noSecrets],
  }),
});
```

Use `when` to combine actions for different confidence bands. Cases run in the
order you provide them. If no case matches, the failed finding does not block:

```ts
const possibleSecrets = new Policy({
  id: "possible-secrets",
  name: "Possible secrets",
  instruction: "Choose a response by finding confidence.",
  action: when(
    {
      // Deny high-confidence findings.
      confidence: 0.95,
      action: deny("Do not share secrets."),
    },
    {
      // Escalate uncertain findings for detailed review.
      confidence: 0.4,
      action: escalate({
        policy: productionSecrets,
      }),
    },
  ),
});
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
