import type {
  DenyPolicyAction,
  EscalatePolicyAction,
  PolicyAction,
  WhenPolicyAction,
  WhenPolicyActionCase,
} from "./actions";
import type {
  EvaluationRequest,
  PolicyDecision,
  PolicyEscalation,
  PolicyEvaluator,
  PolicyFinding,
  PolicyViolation,
} from "./evaluation";
import { Policy, type PolicyOptions } from "./policy";

/**
 * Configuration for creating a policy pipeline.
 */
export type PolicyPipelineConfig = {
  /** Evaluator used to produce findings for each evaluation request. */
  readonly evaluator: PolicyEvaluator;
  /** Policies to evaluate, provided as instances or plain configuration. */
  readonly policies: readonly (Policy | PolicyOptions)[];
};

/**
 * Evaluates requests against configured policies and returns allow or deny decisions.
 */
export class PolicyPipeline {
  /** Evaluator used to produce findings for each evaluation request. */
  readonly evaluator: PolicyEvaluator;
  /** Policies normalized to {@link Policy} instances. */
  readonly policies: readonly Policy[];

  /**
   * Creates a policy pipeline and normalizes plain policy options to {@link Policy} instances.
   */
  constructor(config: PolicyPipelineConfig) {
    this.evaluator = config.evaluator;
    this.policies = config.policies.map((policy) =>
      policy instanceof Policy ? policy : new Policy(policy),
    );
  }

  /**
   * Evaluates a request and returns a decision.
   *
   * Failed findings deny or escalate when they match a configured policy and
   * meet any confidence threshold on that policy's action. Findings for unknown
   * policies are kept but do not block.
   */
  async evaluate(request: EvaluationRequest): Promise<PolicyDecision> {
    const result = await this.evaluatePolicies(request, this.policies);

    if (result.violations.length === 0) {
      return {
        allowed: true,
        request,
        findings: result.findings,
        violations: [],
        escalations: result.escalations,
      };
    }

    const firstViolation = result.violations[0];

    if (firstViolation === undefined) {
      return {
        allowed: true,
        request,
        findings: result.findings,
        violations: [],
        escalations: result.escalations,
      };
    }

    return {
      allowed: false,
      request,
      findings: result.findings,
      violations: result.violations,
      escalations: result.escalations,
      message: firstViolation.message,
    };
  }

  private async evaluatePolicies(
    request: EvaluationRequest,
    policies: readonly Policy[],
  ): Promise<{
    readonly findings: readonly PolicyFinding[];
    readonly violations: readonly PolicyViolation[];
    readonly escalations: readonly PolicyEscalation[];
  }> {
    const findings = await this.evaluator({
      request,
      policies,
    });
    const violations: PolicyViolation[] = [];
    const escalations: PolicyEscalation[] = [];

    for (const finding of findings) {
      if (finding.passed) {
        continue;
      }

      const policy = policies.find((candidate) => candidate.id === finding.policyId);

      if (policy === undefined) {
        continue;
      }

      const action = this.resolveAction(finding, policy.action);

      if (action === undefined) {
        continue;
      }

      if (action.type === "deny") {
        violations.push({
          policy,
          finding,
          action,
          message: action.message,
        });
        continue;
      }

      const nestedPolicies = action.policies.map((nestedPolicy) => new Policy(nestedPolicy));
      const nestedResult = await this.evaluatePolicies(request, nestedPolicies);

      escalations.push({
        policy,
        finding,
        action,
        policies: nestedPolicies,
        findings: nestedResult.findings,
        violations: nestedResult.violations,
      });
      escalations.push(...nestedResult.escalations);
      violations.push(...nestedResult.violations);
    }

    return {
      findings,
      violations,
      escalations,
    };
  }

  private resolveAction(
    finding: PolicyFinding,
    action: PolicyAction,
  ): DenyPolicyAction | EscalatePolicyAction | undefined {
    if (action.type === "when") {
      return this.resolveWhenAction(finding, action);
    }

    if (!this.meetsConfidenceThreshold(finding, action.confidence)) {
      return undefined;
    }

    return action;
  }

  private resolveWhenAction(
    finding: PolicyFinding,
    action: WhenPolicyAction,
  ): DenyPolicyAction | EscalatePolicyAction | undefined {
    const matchedCase = action.cases.find((candidate) =>
      this.meetsConfidenceThreshold(finding, candidate.confidence),
    );

    if (matchedCase === undefined) {
      return undefined;
    }

    return this.resolveCaseAction(finding, matchedCase);
  }

  private resolveCaseAction(
    finding: PolicyFinding,
    actionCase: WhenPolicyActionCase,
  ): DenyPolicyAction | EscalatePolicyAction | undefined {
    if (!this.meetsConfidenceThreshold(finding, actionCase.action.confidence)) {
      return undefined;
    }

    return actionCase.action;
  }

  private meetsConfidenceThreshold(finding: PolicyFinding, threshold: number | undefined): boolean {
    if (threshold === undefined) {
      return true;
    }

    return finding.confidence !== undefined && finding.confidence >= threshold;
  }
}
