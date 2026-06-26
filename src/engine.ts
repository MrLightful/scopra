import type {
  EvaluationRequest,
  PolicyDecision,
  PolicyEvaluator,
  PolicyFinding,
  PolicyViolation,
} from "./evaluation";
import { Policy, type PolicyOptions } from "./policy";

export type PolicyEngineConfig = {
  readonly evaluator: PolicyEvaluator;
  readonly policies: readonly (Policy | PolicyOptions)[];
};

export class PolicyEngine {
  readonly evaluator: PolicyEvaluator;
  readonly policies: readonly Policy[];

  constructor(config: PolicyEngineConfig) {
    this.evaluator = config.evaluator;
    this.policies = config.policies.map((policy) =>
      policy instanceof Policy ? policy : new Policy(policy),
    );
  }

  async evaluate(request: EvaluationRequest): Promise<PolicyDecision> {
    const findings = await this.evaluator({
      request,
      policies: this.policies,
    });
    const violations = findings
      .filter((finding) => !finding.passed)
      .map((finding) => this.toViolation(finding))
      .filter((violation): violation is PolicyViolation => violation !== undefined);

    if (violations.length === 0) {
      return {
        allowed: true,
        request,
        findings,
        violations: [],
      };
    }

    const firstViolation = violations[0];

    if (firstViolation === undefined) {
      return {
        allowed: true,
        request,
        findings,
        violations: [],
      };
    }

    return {
      allowed: false,
      request,
      findings,
      violations,
      message: firstViolation.message,
    };
  }

  private toViolation(finding: PolicyFinding): PolicyViolation | undefined {
    const policy = this.policies.find((candidate) => candidate.id === finding.policyId);

    if (policy === undefined) {
      return undefined;
    }

    if (policy.action.type !== "deny") {
      return undefined;
    }

    return {
      policy,
      finding,
      action: policy.action,
      message: policy.action.message,
    };
  }
}
