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
   * Failed findings deny when they match a configured policy and meet any
   * configured denial confidence threshold. Low-confidence findings escalate
   * when they match a configured escalation policy. Findings for unknown
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

    return {
      allowed: false,
      request,
      findings: result.findings,
      violations: result.violations,
      escalations: result.escalations,
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
      const policy = policies.find((candidate) => candidate.id === finding.policyId);

      if (policy === undefined) {
        continue;
      }

      if (policy.escalation !== undefined) {
        if (this.meetsEscalationThreshold(finding, policy.escalation.maxConfidence)) {
          const nestedPolicies = policy.escalation.policies.map(
            (nestedPolicy) => new Policy(nestedPolicy),
          );
          const nestedResult = await this.evaluatePolicies(request, nestedPolicies);

          escalations.push({
            policy,
            finding,
            escalation: policy.escalation,
            policies: nestedPolicies,
            findings: nestedResult.findings,
            violations: nestedResult.violations,
          });
          escalations.push(...nestedResult.escalations);
          violations.push(...nestedResult.violations);
        }

        continue;
      }

      if (finding.passed) {
        continue;
      }

      if (!this.meetsConfidenceThreshold(finding, policy.confidence)) {
        continue;
      }

      violations.push({
        policy,
        finding,
        message: policy.message,
      });
    }

    return {
      findings,
      violations,
      escalations,
    };
  }

  private meetsConfidenceThreshold(finding: PolicyFinding, threshold: number | undefined): boolean {
    if (threshold === undefined) {
      return true;
    }

    return finding.confidence !== undefined && finding.confidence >= threshold;
  }

  private meetsEscalationThreshold(finding: PolicyFinding, maxConfidence: number): boolean {
    return finding.confidence !== undefined && finding.confidence <= maxConfidence;
  }
}
