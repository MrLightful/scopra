import { describe, expect, test } from "bun:test";
import { deny, escalate, Policy, type PolicyOptions, when } from "./index";

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

const highRiskSecretsPolicy: PolicyOptions = {
  id: "high-risk-secrets",
  name: "High-risk secrets",
  description: "Prevents exposed production secrets.",
  instruction: "Block exposed production API keys and credentials.",
  action: deny("Do not share production secrets."),
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

  test("creates a policy with one escalation policy", () => {
    const policy = new Policy({
      ...noSecretsPolicy,
      action: escalate({
        policy: highRiskSecretsPolicy,
      }),
    });

    expect(policy.action).toEqual({
      type: "escalate",
      policies: [highRiskSecretsPolicy],
    });
  });

  test("creates a policy with multiple escalation policies and options", () => {
    const policy = new Policy({
      ...noSecretsPolicy,
      action: escalate({
        policies: [highRiskSecretsPolicy, stayInScopePolicy],
        confidence: 0.4,
      }),
    });

    expect(policy.action).toEqual({
      type: "escalate",
      policies: [highRiskSecretsPolicy, stayInScopePolicy],
      confidence: 0.4,
    });
  });

  test("rejects escalation without nested policies", () => {
    expect(() =>
      escalate({
        policies: [],
      }),
    ).toThrow("at least one policy");
  });

  test("rejects conditional actions without cases", () => {
    expect(() => when()).toThrow("at least one case");
  });
});
