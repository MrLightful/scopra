import type {
  EvaluationRequest,
  PolicyDecision,
  PolicyEvaluator,
  PolicyFinding,
  PolicyViolation,
} from "./evaluation";
import { Policy, type PolicyOptions } from "./policy";

/**
 * Configuration for creating a policy engine.
 */
export type PolicyEngineConfig = {
  /** Evaluator used to produce findings for each evaluation request. */
  readonly evaluator: PolicyEvaluator;
  /** Policies to evaluate, provided as instances or plain configuration. */
  readonly policies: readonly (Policy | PolicyOptions)[];
};

/**
 * Evaluates requests against configured policies and returns allow or deny decisions.
 */
export class PolicyEngine {
  /** Evaluator used to produce findings for each evaluation request. */
  readonly evaluator: PolicyEvaluator;
  /** Policies normalized to {@link Policy} instances. */
  readonly policies: readonly Policy[];

  /**
   * Creates a policy engine and normalizes plain policy options to {@link Policy} instances.
   */
  constructor(config: PolicyEngineConfig) {
    this.evaluator = config.evaluator;
    this.policies = config.policies.map((policy) =>
      policy instanceof Policy ? policy : new Policy(policy),
    );
  }

  /**
   * Evaluates a request and returns a decision.
   *
   * Failed findings deny the request when they match a configured policy.
   * Findings for unknown policies are kept but do not block.
   */
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

    return {
      policy,
      finding,
      action: policy.action,
      message: policy.action.message,
    };
  }
}
