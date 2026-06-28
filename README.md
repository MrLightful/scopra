# protec

Developer-first TypeScript policy enforcement for AI applications.

Protec sits alongside your model and evaluates user inputs, model outputs, and tool
invocations before the workflow continues.

## Install

```sh
bun add protec
```

Install the AI SDK you want to use with the model-backed evaluator:

```sh
bun add @ai-sdk/openai
```

## Usage

```ts
import { openai } from "@ai-sdk/openai";
import { AgentScopePolicy, NoSecretsPolicy, PolicyPipeline, vercel } from "protec";

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
  evaluator: vercel(openai("gpt-4.1")),
});
```

TanStack AI adapters work through the `tanstack()` helper:

```ts
import { openaiText } from "@tanstack/ai-openai";
import { NoSecretsPolicy, PolicyPipeline, tanstack } from "protec";

const pipeline = new PolicyPipeline({
  policies: [new NoSecretsPolicy()],
  evaluator: tanstack(openaiText("gpt-5.2")),
});
```

Common policies are regular `Policy` instances, so they work anywhere a policy is
accepted:

```ts
import { openai } from "@ai-sdk/openai";
import {
  AgentScopePolicy,
  CopyrightPolicy,
  FinancialAdvicePolicy,
  LegalAdvicePolicy,
  MedicalAdvicePolicy,
  NoSecretsPolicy,
  PersonalDataPolicy,
  PolicyPipeline,
  PromptInjectionPolicy,
  RegulatedAdvicePolicy,
  UnsafeToolUsePolicy,
  vercel,
} from "protec";

const pipeline = new PolicyPipeline({
  policies: [
    new NoSecretsPolicy(),
    new PersonalDataPolicy(),
    new CopyrightPolicy(),
    new PromptInjectionPolicy(),
    new RegulatedAdvicePolicy(),
    new MedicalAdvicePolicy(),
    new LegalAdvicePolicy(),
    new FinancialAdvicePolicy(),
    new UnsafeToolUsePolicy(),
    new AgentScopePolicy({
      scope: "Customer support for Acme billing only.",
    }),
  ],
  evaluator: vercel(openai("gpt-4.1")),
});
```

Pass `message`, `confidence`, or `escalation` when a common policy should
override its default denial behavior.

```ts
import { NoSecretsPolicy } from "protec";

const noSecrets = new NoSecretsPolicy({
  message: "Custom secret warning.",
  confidence: 0.95,
});
```

You can also define policies directly:

```ts
import { openai } from "@ai-sdk/openai";
import { Policy, PolicyPipeline, vercel } from "protec";

const noSecrets = new Policy({
  id: "no-secrets",
  name: "No secrets",
  description: "Prevents sensitive data exposure.",
  instruction: "Block exposed API keys and secrets.",
  message: "Do not share secrets.",
  confidence: 0.95,
});

const pipeline = new PolicyPipeline({
  policies: [noSecrets],
  evaluator: vercel(openai("gpt-4.1")),
});

const decision = await pipeline.evaluate({
  type: "output",
  content: "Here is the answer.",
});

if (!decision.allowed) {
  console.log(decision.violations[0]?.message);
}
```

When you want a more tailored user-facing response, generate one from the
denied decision:

```ts
import { openai } from "@ai-sdk/openai";
import {
  NoSecretsPolicy,
  PolicyPipeline,
  generateViolationResponse,
  vercel,
} from "protec";

const model = vercel(openai("gpt-4.1"));

const pipeline = new PolicyPipeline({
  policies: [new NoSecretsPolicy()],
  evaluator: model,
});

const decision = await pipeline.evaluate({
  type: "output",
  content: "sk_live_123",
});

if (!decision.allowed) {
  const response = await generateViolationResponse(model, decision);

  console.log(response);
}
```

The response generator infers the response language from the denied request and
violation context by default. Pass `locale` when you want to guide the response
toward a specific language or regional variant. BCP 47 tags such as `"nb-NO"` or
`"es-MX"` are recommended, but plain labels such as `"Norwegian"` are accepted
as model guidance.

```ts
if (!decision.allowed) {
  const response = await generateViolationResponse(model, decision, {
    locale: "nb-NO",
  });

  console.log(response);
}
```

Common policy messages are not translated automatically. Pass localized
`message` overrides on your policies when you want those denial messages to use
specific wording.

Policies can also escalate low-confidence findings to more detailed policies.
Use a parent policy with a short, possibly generalized instruction to detect
whether a matter may be present, then use escalated policies with more detailed
and elaborate instructions to increase confidence. Use `policy` for one nested
policy or `policies` when a second pass should check multiple rules.
Escalations require `maxConfidence`; pass or fail findings at or below that
confidence trigger the detailed review:

```ts
const productionSecrets = {
  id: "production-secrets",
  name: "Production secrets",
  instruction:
    "Confirm whether the content exposes production API keys, credentials, tokens, or other deployable secrets.",
  message: "Do not share production secrets.",
};

const possibleSecrets = new Policy({
  id: "possible-secrets",
  name: "Possible secrets",
  instruction: "Detect whether the content may contain secrets.",
  message: "Review possible secrets.",
  escalation: {
    policy: productionSecrets,
    // Escalate when the parent finding has confidence <= 0.4.
    maxConfidence: 0.4,
  },
});

const pipeline = new PolicyPipeline({
  policies: [possibleSecrets],
  evaluator: vercel(openai("gpt-4.1")),
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
  message: "Review possible problems.",
  escalation: {
    policies: [productionSecrets, noSecrets],
    maxConfidence: 0.4,
  },
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
