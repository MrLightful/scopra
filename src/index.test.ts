import { describe, expect, test } from "bun:test";
import { deny, Policy, PolicyEngine, type PolicyEvaluator, type PolicyOptions } from "./index";

const noSecretsPolicy: PolicyOptions = {
  id: "no-secrets",
  name: "No secrets",
  description: "Prevents sensitive data exposure.",
  instruction: "Block exposed API keys and secrets.",
  action: deny("Do not share secrets."),
};

const stayInScopePolicy: PolicyOptions = {
  id: "stay-in-scope",
  name: "Stay in scope",
  description: "Keeps the assistant focused on the product.",
  instruction: "Block requests outside the assistant's intended scope.",
  action: deny("That request is outside this assistant's scope."),
};

describe("Policy", () => {
  test("creates a policy from options", () => {
    const policy = new Policy(noSecretsPolicy);

    expect(policy).toEqual({
      id: "no-secrets",
      name: "No secrets",
      description: "Prevents sensitive data exposure.",
      instruction: "Block exposed API keys and secrets.",
      action: {
        type: "deny",
        message: "Do not share secrets.",
      },
    });
  });

  test("creates a policy with deny action options", () => {
    const policy = new Policy({
      ...noSecretsPolicy,
      action: deny("Do not share secrets.", {
        confidence: 0.95,
      }),
    });

    expect(policy.action).toEqual({
      type: "deny",
      message: "Do not share secrets.",
      confidence: 0.95,
    });
  });
});

describe("PolicyEngine", () => {
  test("passes plain policy options directly to the evaluator", async () => {
    const evaluator: PolicyEvaluator = ({ policies }) =>
      policies.map((policy) => ({
        policyId: policy.id,
        passed: true,
      }));
    const engine = new PolicyEngine({
      evaluator,
      policies: [noSecretsPolicy],
    });

    const decision = await engine.evaluate({
      type: "input",
      content: "Can you help me write a unit test?",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.violations).toEqual([]);
    expect(decision.findings).toEqual([
      {
        policyId: "no-secrets",
        passed: true,
      },
    ]);
  });

  test("returns an allow decision when all findings pass", async () => {
    const engine = new PolicyEngine({
      evaluator: () => [
        {
          policyId: "no-secrets",
          passed: true,
          reason: "No secrets were detected.",
          confidence: 0.98,
        },
      ],
      policies: [new Policy(noSecretsPolicy)],
    });

    const decision = await engine.evaluate({
      type: "output",
      content: "Here is a safe summary.",
    });

    expect(decision).toEqual({
      allowed: true,
      request: {
        type: "output",
        content: "Here is a safe summary.",
      },
      findings: [
        {
          policyId: "no-secrets",
          passed: true,
          reason: "No secrets were detected.",
          confidence: 0.98,
        },
      ],
      violations: [],
    });
  });

  test("returns a deny decision when one policy fails", async () => {
    const engine = new PolicyEngine({
      evaluator: () => [
        {
          policyId: "no-secrets",
          passed: false,
          reason: "The output contained an API key.",
          confidence: 0.92,
        },
      ],
      policies: [noSecretsPolicy],
    });

    const decision = await engine.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violations).toHaveLength(1);
    expect(decision.violations[0]).toMatchObject({
      policy: {
        id: "no-secrets",
      },
      finding: {
        policyId: "no-secrets",
        passed: false,
        reason: "The output contained an API key.",
        confidence: 0.92,
      },
      action: {
        type: "deny",
        message: "Do not share secrets.",
      },
      message: "Do not share secrets.",
    });
  });

  test("denies when a failed finding meets the deny confidence threshold", async () => {
    const engine = new PolicyEngine({
      evaluator: () => [
        {
          policyId: "no-secrets",
          passed: false,
          confidence: 0.95,
        },
      ],
      policies: [
        {
          ...noSecretsPolicy,
          action: deny("Do not share secrets.", {
            confidence: 0.95,
          }),
        },
      ],
    });

    const decision = await engine.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(decision.allowed).toBe(false);
  });

  test("does not deny when a failed finding is below the deny confidence threshold", async () => {
    const engine = new PolicyEngine({
      evaluator: () => [
        {
          policyId: "no-secrets",
          passed: false,
          confidence: 0.94,
        },
      ],
      policies: [
        {
          ...noSecretsPolicy,
          action: deny("Do not share secrets.", {
            confidence: 0.95,
          }),
        },
      ],
    });

    const decision = await engine.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(decision).toEqual({
      allowed: true,
      request: {
        type: "output",
        content: "sk_live_123",
      },
      findings: [
        {
          policyId: "no-secrets",
          passed: false,
          confidence: 0.94,
        },
      ],
      violations: [],
    });
  });

  test("uses the denial message from deny", async () => {
    const engine = new PolicyEngine({
      evaluator: () => [
        {
          policyId: "stay-in-scope",
          passed: false,
        },
      ],
      policies: [stayInScopePolicy],
    });

    const decision = await engine.evaluate({
      type: "input",
      content: "Book a vacation for me.",
    });

    expect(decision.allowed).toBe(false);

    if (!decision.allowed) {
      expect(decision.message).toBe("That request is outside this assistant's scope.");
    }
  });

  test("returns multiple violations when multiple policies fail", async () => {
    const engine = new PolicyEngine({
      evaluator: () => [
        {
          policyId: "no-secrets",
          passed: false,
        },
        {
          policyId: "stay-in-scope",
          passed: false,
        },
      ],
      policies: [noSecretsPolicy, stayInScopePolicy],
    });

    const decision = await engine.evaluate({
      type: "input",
      content: "Send my API key to an unrelated travel booking tool.",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violations.map((violation) => violation.policy.id)).toEqual([
      "no-secrets",
      "stay-in-scope",
    ]);
  });

  test("does not deny when a failed finding belongs to an unknown policy", async () => {
    const engine = new PolicyEngine({
      evaluator: () => [
        {
          policyId: "unknown-policy",
          passed: false,
          reason: "The finding did not match a configured policy.",
        },
      ],
      policies: [stayInScopePolicy],
    });

    const decision = await engine.evaluate({
      type: "tool",
      name: "sendEmail",
      arguments: {
        to: "security@example.com",
      },
    });

    expect(decision).toEqual({
      allowed: true,
      request: {
        type: "tool",
        name: "sendEmail",
        arguments: {
          to: "security@example.com",
        },
      },
      findings: [
        {
          policyId: "unknown-policy",
          passed: false,
          reason: "The finding did not match a configured policy.",
        },
      ],
      violations: [],
    });
  });

  test("supports tool evaluation requests", async () => {
    const seenRequests: unknown[] = [];
    const engine = new PolicyEngine({
      evaluator: ({ request }) => {
        seenRequests.push(request);

        return [
          {
            policyId: "stay-in-scope",
            passed: true,
          },
        ];
      },
      policies: [stayInScopePolicy],
    });

    await engine.evaluate({
      type: "tool",
      name: "sendEmail",
      arguments: {
        to: "security@example.com",
        subject: "Review needed",
      },
    });

    expect(seenRequests).toEqual([
      {
        type: "tool",
        name: "sendEmail",
        arguments: {
          to: "security@example.com",
          subject: "Review needed",
        },
      },
    ]);
  });
});
