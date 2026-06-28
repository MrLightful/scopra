import { describe, expect, test } from "bun:test";
import { Policy, type PolicyEscalationOptions, type PolicyOptions } from "./index";

const noSecretsPolicy: PolicyOptions = {
  id: "no-secrets",
  name: "No secrets",
  description: "Prevents sensitive data exposure.",
  instruction: "Block exposed API keys and secrets.",
  message: "Do not share secrets.",
};

const stayInScopePolicy: PolicyOptions = {
  id: "stay-in-scope",
  name: "Stay in scope",
  description: "Keeps the assistant focused on the product.",
  instruction: "Block requests outside the assistant's intended scope.",
  message: "That request is outside this assistant's scope.",
};

const highRiskSecretsPolicy: PolicyOptions = {
  id: "high-risk-secrets",
  name: "High-risk secrets",
  description: "Prevents exposed production secrets.",
  instruction: "Block exposed production API keys and credentials.",
  message: "Do not share production secrets.",
};

describe("Policy", () => {
  test("creates a policy from options", () => {
    const policy = new Policy(noSecretsPolicy);

    expect(policy).toEqual({
      id: "no-secrets",
      name: "No secrets",
      description: "Prevents sensitive data exposure.",
      instruction: "Block exposed API keys and secrets.",
      message: "Do not share secrets.",
      confidence: undefined,
      escalation: undefined,
    });
  });

  test("creates a policy with denial confidence", () => {
    const policy = new Policy({
      ...noSecretsPolicy,
      confidence: 0.95,
    });

    expect(policy.confidence).toBe(0.95);
  });

  test("creates a policy with one escalation policy", () => {
    const policy = new Policy({
      ...noSecretsPolicy,
      escalation: {
        policy: highRiskSecretsPolicy,
        maxConfidence: 0.4,
      },
    });

    expect(policy.escalation).toEqual({
      policies: [highRiskSecretsPolicy],
      maxConfidence: 0.4,
    });
  });

  test("creates a policy with multiple escalation policies and options", () => {
    const policy = new Policy({
      ...noSecretsPolicy,
      escalation: {
        policies: [highRiskSecretsPolicy, stayInScopePolicy],
        maxConfidence: 0.4,
      },
    });

    expect(policy.escalation).toEqual({
      policies: [highRiskSecretsPolicy, stayInScopePolicy],
      maxConfidence: 0.4,
    });
  });

  test("rejects escalation without max confidence", () => {
    expect(
      () =>
        new Policy({
          ...noSecretsPolicy,
          escalation: {
            policy: highRiskSecretsPolicy,
          } as unknown as PolicyEscalationOptions,
        }),
    ).toThrow("maxConfidence");
  });

  test("rejects escalation with old confidence option", () => {
    expect(
      () =>
        new Policy({
          ...noSecretsPolicy,
          escalation: {
            policy: highRiskSecretsPolicy,
            confidence: 0.4,
          } as unknown as PolicyEscalationOptions,
        }),
    ).toThrow("maxConfidence");
  });

  test("rejects escalation without nested policies", () => {
    expect(
      () =>
        new Policy({
          ...noSecretsPolicy,
          escalation: {
            policies: [],
            maxConfidence: 0.4,
          },
        }),
    ).toThrow("at least one policy");
  });

  test("rejects escalation with both policy and policies", () => {
    expect(
      () =>
        new Policy({
          ...noSecretsPolicy,
          escalation: {
            policy: highRiskSecretsPolicy,
            policies: [stayInScopePolicy],
            maxConfidence: 0.4,
          } as unknown as PolicyEscalationOptions,
        }),
    ).toThrow("exactly one of policy or policies");
  });
});
