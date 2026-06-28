import { describe, expect, test } from "bun:test";
import {
  AgentScopePolicy,
  CopyrightPolicy,
  FinancialAdvicePolicy,
  LegalAdvicePolicy,
  MedicalAdvicePolicy,
  NoSecretsPolicy,
  PersonalDataPolicy,
  Policy,
  type PolicyEvaluator,
  type PolicyOptions,
  PromptInjectionPolicy,
  RegulatedAdvicePolicy,
  UnsafeToolUsePolicy,
} from "./index";

const detailPolicy: PolicyOptions = {
  id: "detail",
  name: "Detail",
  instruction: "Check the detailed case.",
  message: "Detailed denial.",
};

describe("common policies", () => {
  test("creates the no secrets policy", () => {
    const policy = new NoSecretsPolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy).toEqual({
      id: "no-secrets",
      name: "No secrets",
      description: "Prevents sensitive credential and secret exposure.",
      instruction:
        "Fail when the evaluated input, output, or tool invocation exposes API keys, access tokens, passwords, private keys, signing secrets, database credentials, or other authentication secrets. Pass benign discussion of secret handling that does not reveal an actual secret.",
      message: "Do not share secrets.",
      evaluator: undefined,
      confidence: undefined,
      escalation: undefined,
    });
  });

  test("creates the personal data policy", () => {
    const policy = new PersonalDataPolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy.message).toBe("Do not share sensitive personal data.");
    expect(policy.escalation).toBeUndefined();
  });

  test("creates the copyright policy", () => {
    const policy = new CopyrightPolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy.message).toBe("Do not reproduce protected content.");
  });

  test("creates the prompt injection policy", () => {
    const policy = new PromptInjectionPolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy.message).toBe("That request attempts to bypass the agent's instructions.");
  });

  test("creates the regulated advice policy", () => {
    const policy = new RegulatedAdvicePolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy.message).toBe("I cannot provide personalized professional advice.");
  });

  test("creates the medical advice policy", () => {
    const policy = new MedicalAdvicePolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy.message).toBe("I cannot provide personalized medical advice.");
  });

  test("creates the legal advice policy", () => {
    const policy = new LegalAdvicePolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy.message).toBe("I cannot provide personalized legal advice.");
  });

  test("creates the financial advice policy", () => {
    const policy = new FinancialAdvicePolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy.message).toBe("I cannot provide personalized financial advice.");
  });

  test("creates the unsafe tool use policy", () => {
    const policy = new UnsafeToolUsePolicy();

    expect(policy).toBeInstanceOf(Policy);
    expect(policy.message).toBe("That tool action is not allowed.");
  });

  test("creates the agent scope policy with the provided scope", () => {
    const policy = new AgentScopePolicy({
      scope: "Customer support for Acme billing only.",
    });

    expect(policy).toBeInstanceOf(Policy);
    expect(policy).toMatchObject({
      id: "agent-scope",
      name: "Agent scope",
      description: "Keeps the agent within its configured scope.",
      message: "That request is outside this agent's scope.",
    });
    expect(policy.instruction).toBe(
      "Fail when the evaluated input, output, or tool invocation is outside this agent's allowed scope: Customer support for Acme billing only. Pass requests that are within scope or are necessary clarifying questions for the scoped task.",
    );
  });

  test("applies message and confidence overrides", () => {
    const policy = new NoSecretsPolicy({
      message: "Custom secret warning.",
      confidence: 0.9,
    });

    expect(policy.message).toBe("Custom secret warning.");
    expect(policy.confidence).toBe(0.9);
  });

  test("applies evaluator overrides", () => {
    const evaluator: PolicyEvaluator = ({ policies }) =>
      policies.map((policy) => ({
        policyId: policy.id,
        passed: true,
      }));
    const policy = new NoSecretsPolicy({
      evaluator,
    });

    expect(policy.evaluator).toBe(evaluator);
  });

  test("applies escalation overrides", () => {
    const policy = new PromptInjectionPolicy({
      message: "Review prompt injection.",
      confidence: 0.5,
      escalation: {
        policy: detailPolicy,
        maxConfidence: 0.8,
      },
    });

    expect(policy.message).toBe("Review prompt injection.");
    expect(policy.confidence).toBe(0.5);
    expect(policy.escalation).toEqual({
      policies: [detailPolicy],
      maxConfidence: 0.8,
    });
  });

  test("applies options for advice and copyright policies", () => {
    const options = {
      message: "Custom advice warning.",
      confidence: 0.8,
      escalation: {
        policy: detailPolicy,
        maxConfidence: 0.7,
      },
    };

    expect(new CopyrightPolicy(options).message).toBe(options.message);
    expect(new RegulatedAdvicePolicy(options).confidence).toBe(options.confidence);
    expect(new MedicalAdvicePolicy(options).escalation?.policies).toEqual([detailPolicy]);
    expect(new LegalAdvicePolicy(options).message).toBe(options.message);
    expect(new FinancialAdvicePolicy(options).confidence).toBe(options.confidence);
  });
});
