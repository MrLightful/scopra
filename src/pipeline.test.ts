import { describe, expect, test } from "bun:test";
import {
  deny,
  escalate,
  Policy,
  type PolicyEvaluator,
  type PolicyOptions,
  PolicyPipeline,
  when,
} from "./index";

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

describe("PolicyPipeline", () => {
  test("passes plain policy options directly to the evaluator", async () => {
    const evaluator: PolicyEvaluator = ({ policies }) =>
      policies.map((policy) => ({
        policyId: policy.id,
        passed: true,
      }));
    const pipeline = new PolicyPipeline({
      evaluator,
      policies: [noSecretsPolicy],
    });

    const decision = await pipeline.evaluate({
      type: "input",
      content: "Can you help me write a unit test?",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.violations).toEqual([]);
    expect(decision.escalations).toEqual([]);
    expect(decision.findings).toEqual([
      {
        policyId: "no-secrets",
        passed: true,
      },
    ]);
  });

  test("returns an allow decision when all findings pass", async () => {
    const pipeline = new PolicyPipeline({
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

    const decision = await pipeline.evaluate({
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
      escalations: [],
    });
  });

  test("returns a deny decision when one policy fails", async () => {
    const pipeline = new PolicyPipeline({
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

    const decision = await pipeline.evaluate({
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
    const pipeline = new PolicyPipeline({
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

    const decision = await pipeline.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(decision.allowed).toBe(false);
  });

  test("does not deny when a failed finding is below the deny confidence threshold", async () => {
    const pipeline = new PolicyPipeline({
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

    const decision = await pipeline.evaluate({
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
      escalations: [],
    });
  });

  test("auto-runs one nested escalation policy", async () => {
    const seenPolicies: string[][] = [];
    const pipeline = new PolicyPipeline({
      evaluator: ({ policies }) => {
        seenPolicies.push(policies.map((policy) => policy.id));

        if (policies[0]?.id === "possible-secrets") {
          return [
            {
              policyId: "possible-secrets",
              passed: false,
              reason: "The output might contain a credential.",
              confidence: 0.45,
            },
          ];
        }

        return [
          {
            policyId: "high-risk-secrets",
            passed: false,
            reason: "The output contained a production API key.",
            confidence: 0.97,
          },
        ];
      },
      policies: [
        {
          id: "possible-secrets",
          name: "Possible secrets",
          instruction: "Escalate possible secrets for detailed review.",
          action: escalate({
            policy: highRiskSecretsPolicy,
            confidence: 0.4,
          }),
        },
      ],
    });

    const decision = await pipeline.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(seenPolicies).toEqual([["possible-secrets"], ["high-risk-secrets"]]);
    expect(decision.allowed).toBe(false);

    if (!decision.allowed) {
      expect(decision.message).toBe("Do not share production secrets.");
    }

    expect(decision.findings).toEqual([
      {
        policyId: "possible-secrets",
        passed: false,
        reason: "The output might contain a credential.",
        confidence: 0.45,
      },
    ]);
    expect(decision.violations.map((violation) => violation.policy.id)).toEqual([
      "high-risk-secrets",
    ]);
    expect(decision.escalations).toHaveLength(1);
    expect(decision.escalations[0]).toMatchObject({
      policy: {
        id: "possible-secrets",
      },
      finding: {
        policyId: "possible-secrets",
        passed: false,
        confidence: 0.45,
      },
      action: {
        type: "escalate",
        confidence: 0.4,
      },
      policies: [
        {
          id: "high-risk-secrets",
        },
      ],
      findings: [
        {
          policyId: "high-risk-secrets",
          passed: false,
          reason: "The output contained a production API key.",
          confidence: 0.97,
        },
      ],
      violations: [
        {
          policy: {
            id: "high-risk-secrets",
          },
          message: "Do not share production secrets.",
        },
      ],
    });
  });

  test("auto-runs multiple nested escalation policies", async () => {
    const pipeline = new PolicyPipeline({
      evaluator: ({ policies }) => {
        if (policies[0]?.id === "possible-problem") {
          return [
            {
              policyId: "possible-problem",
              passed: false,
              confidence: 0.6,
            },
          ];
        }

        return policies.map((policy) => ({
          policyId: policy.id,
          passed: true,
        }));
      },
      policies: [
        {
          id: "possible-problem",
          name: "Possible problem",
          instruction: "Escalate possible problems for detailed review.",
          action: escalate({
            policies: [highRiskSecretsPolicy, stayInScopePolicy],
          }),
        },
      ],
    });

    const decision = await pipeline.evaluate({
      type: "input",
      content: "Can you help me check this?",
    });

    expect(decision).toEqual({
      allowed: true,
      request: {
        type: "input",
        content: "Can you help me check this?",
      },
      findings: [
        {
          policyId: "possible-problem",
          passed: false,
          confidence: 0.6,
        },
      ],
      violations: [],
      escalations: [
        {
          policy: new Policy({
            id: "possible-problem",
            name: "Possible problem",
            instruction: "Escalate possible problems for detailed review.",
            action: escalate({
              policies: [highRiskSecretsPolicy, stayInScopePolicy],
            }),
          }),
          finding: {
            policyId: "possible-problem",
            passed: false,
            confidence: 0.6,
          },
          action: escalate({
            policies: [highRiskSecretsPolicy, stayInScopePolicy],
          }),
          policies: [new Policy(highRiskSecretsPolicy), new Policy(stayInScopePolicy)],
          findings: [
            {
              policyId: "high-risk-secrets",
              passed: true,
            },
            {
              policyId: "stay-in-scope",
              passed: true,
            },
          ],
          violations: [],
        },
      ],
    });
  });

  test("does not escalate when a failed finding is below the escalation confidence threshold", async () => {
    const seenPolicies: string[][] = [];
    const pipeline = new PolicyPipeline({
      evaluator: ({ policies }) => {
        seenPolicies.push(policies.map((policy) => policy.id));

        return [
          {
            policyId: "possible-secrets",
            passed: false,
            confidence: 0.39,
          },
        ];
      },
      policies: [
        {
          id: "possible-secrets",
          name: "Possible secrets",
          instruction: "Escalate possible secrets for detailed review.",
          action: escalate({
            policy: highRiskSecretsPolicy,
            confidence: 0.4,
          }),
        },
      ],
    });

    const decision = await pipeline.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(seenPolicies).toEqual([["possible-secrets"]]);
    expect(decision).toEqual({
      allowed: true,
      request: {
        type: "output",
        content: "sk_live_123",
      },
      findings: [
        {
          policyId: "possible-secrets",
          passed: false,
          confidence: 0.39,
        },
      ],
      violations: [],
      escalations: [],
    });
  });

  test("routes high confidence findings to deny", async () => {
    const pipeline = new PolicyPipeline({
      evaluator: () => [
        {
          policyId: "possible-secrets",
          passed: false,
          confidence: 0.97,
        },
      ],
      policies: [
        {
          id: "possible-secrets",
          name: "Possible secrets",
          instruction: "Choose a response by finding confidence.",
          action: when(
            {
              confidence: 0.95,
              action: deny("Do not share secrets."),
            },
            {
              confidence: 0.4,
              action: escalate({
                policy: highRiskSecretsPolicy,
              }),
            },
          ),
        },
      ],
    });

    const decision = await pipeline.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.violations).toHaveLength(1);
    expect(decision.escalations).toEqual([]);

    if (!decision.allowed) {
      expect(decision.message).toBe("Do not share secrets.");
    }
  });

  test("routes mid confidence findings to escalation", async () => {
    const seenPolicies: string[][] = [];
    const pipeline = new PolicyPipeline({
      evaluator: ({ policies }) => {
        seenPolicies.push(policies.map((policy) => policy.id));

        if (policies[0]?.id === "possible-secrets") {
          return [
            {
              policyId: "possible-secrets",
              passed: false,
              confidence: 0.7,
            },
          ];
        }

        return [
          {
            policyId: "high-risk-secrets",
            passed: false,
            confidence: 0.96,
          },
        ];
      },
      policies: [
        {
          id: "possible-secrets",
          name: "Possible secrets",
          instruction: "Choose a response by finding confidence.",
          action: when(
            {
              confidence: 0.95,
              action: deny("Do not share secrets."),
            },
            {
              confidence: 0.4,
              action: escalate({
                policy: highRiskSecretsPolicy,
              }),
            },
          ),
        },
      ],
    });

    const decision = await pipeline.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(seenPolicies).toEqual([["possible-secrets"], ["high-risk-secrets"]]);
    expect(decision.allowed).toBe(false);
    expect(decision.violations.map((violation) => violation.policy.id)).toEqual([
      "high-risk-secrets",
    ]);
    expect(decision.escalations).toHaveLength(1);
  });

  test("allows low confidence findings when no conditional action matches", async () => {
    const seenPolicies: string[][] = [];
    const pipeline = new PolicyPipeline({
      evaluator: ({ policies }) => {
        seenPolicies.push(policies.map((policy) => policy.id));

        return [
          {
            policyId: "possible-secrets",
            passed: false,
            confidence: 0.2,
          },
        ];
      },
      policies: [
        {
          id: "possible-secrets",
          name: "Possible secrets",
          instruction: "Choose a response by finding confidence.",
          action: when(
            {
              confidence: 0.95,
              action: deny("Do not share secrets."),
            },
            {
              confidence: 0.4,
              action: escalate({
                policy: highRiskSecretsPolicy,
              }),
            },
          ),
        },
      ],
    });

    const decision = await pipeline.evaluate({
      type: "output",
      content: "possible secret",
    });

    expect(seenPolicies).toEqual([["possible-secrets"]]);
    expect(decision).toEqual({
      allowed: true,
      request: {
        type: "output",
        content: "possible secret",
      },
      findings: [
        {
          policyId: "possible-secrets",
          passed: false,
          confidence: 0.2,
        },
      ],
      violations: [],
      escalations: [],
    });
  });

  test("uses the first matching conditional action", async () => {
    const seenPolicies: string[][] = [];
    const pipeline = new PolicyPipeline({
      evaluator: ({ policies }) => {
        seenPolicies.push(policies.map((policy) => policy.id));

        if (policies[0]?.id === "possible-secrets") {
          return [
            {
              policyId: "possible-secrets",
              passed: false,
              confidence: 0.98,
            },
          ];
        }

        return [
          {
            policyId: "high-risk-secrets",
            passed: false,
            confidence: 0.98,
          },
        ];
      },
      policies: [
        {
          id: "possible-secrets",
          name: "Possible secrets",
          instruction: "Choose a response by finding confidence.",
          action: when(
            {
              confidence: 0.4,
              action: escalate({
                policy: highRiskSecretsPolicy,
              }),
            },
            {
              confidence: 0.95,
              action: deny("Do not share secrets."),
            },
          ),
        },
      ],
    });

    const decision = await pipeline.evaluate({
      type: "output",
      content: "sk_live_123",
    });

    expect(seenPolicies).toEqual([["possible-secrets"], ["high-risk-secrets"]]);
    expect(decision.allowed).toBe(false);
    expect(decision.escalations).toHaveLength(1);
    expect(decision.violations.map((violation) => violation.policy.id)).toEqual([
      "high-risk-secrets",
    ]);
  });

  test("does not match conditional actions when confidence is missing", async () => {
    const pipeline = new PolicyPipeline({
      evaluator: () => [
        {
          policyId: "possible-secrets",
          passed: false,
        },
      ],
      policies: [
        {
          id: "possible-secrets",
          name: "Possible secrets",
          instruction: "Choose a response by finding confidence.",
          action: when({
            confidence: 0.4,
            action: deny("Do not share secrets."),
          }),
        },
      ],
    });

    const decision = await pipeline.evaluate({
      type: "output",
      content: "possible secret",
    });

    expect(decision).toEqual({
      allowed: true,
      request: {
        type: "output",
        content: "possible secret",
      },
      findings: [
        {
          policyId: "possible-secrets",
          passed: false,
        },
      ],
      violations: [],
      escalations: [],
    });
  });

  test("uses the denial message from deny", async () => {
    const pipeline = new PolicyPipeline({
      evaluator: () => [
        {
          policyId: "stay-in-scope",
          passed: false,
        },
      ],
      policies: [stayInScopePolicy],
    });

    const decision = await pipeline.evaluate({
      type: "input",
      content: "Book a vacation for me.",
    });

    expect(decision.allowed).toBe(false);

    if (!decision.allowed) {
      expect(decision.message).toBe("That request is outside this assistant's scope.");
    }
  });

  test("returns multiple violations when multiple policies fail", async () => {
    const pipeline = new PolicyPipeline({
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

    const decision = await pipeline.evaluate({
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
    const pipeline = new PolicyPipeline({
      evaluator: () => [
        {
          policyId: "unknown-policy",
          passed: false,
          reason: "The finding did not match a configured policy.",
        },
      ],
      policies: [stayInScopePolicy],
    });

    const decision = await pipeline.evaluate({
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
      escalations: [],
    });
  });

  test("supports tool evaluation requests", async () => {
    const seenRequests: unknown[] = [];
    const pipeline = new PolicyPipeline({
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

    await pipeline.evaluate({
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
