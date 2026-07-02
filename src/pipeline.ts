import type {
  EvaluationRequest,
  PolicyDecision,
  PolicyEscalation,
  PolicyEvaluator,
  PolicyFinding,
  PolicyViolation,
} from "./evaluation";
import { createEvaluationErrorContext, isScopraError, PolicyEvaluationError } from "./errors";
import { isScopraModel } from "./model";
import { createModelEvaluator, type ModelEvaluatorOptions } from "./model-evaluator";
import { Policy, type PolicyEvaluatorConfig, type PolicyOptions } from "./policy";

/**
 * Evaluator configuration accepted by a policy pipeline.
 */
export type PolicyPipelineEvaluator = PolicyEvaluatorConfig;

/**
 * Configuration for creating a policy pipeline.
 */
export type PolicyPipelineConfig = ModelEvaluatorOptions & {
  /** Evaluator used to produce findings for each evaluation request. */
  readonly evaluator: PolicyPipelineEvaluator;
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
  private readonly modelEvaluatorOptions: ModelEvaluatorOptions;
  private readonly evaluatorOverrides = new Map<PolicyEvaluatorConfig, PolicyEvaluator>();

  /**
   * Creates a policy pipeline and normalizes plain policy options to {@link Policy} instances.
   */
  constructor(config: PolicyPipelineConfig) {
    this.modelEvaluatorOptions = {
      system: config.system,
      abortSignal: config.abortSignal,
      modelOptions: config.modelOptions,
    };
    this.evaluator = isScopraModel(config.evaluator)
      ? createModelEvaluator(config.evaluator, this.modelEvaluatorOptions)
      : config.evaluator;
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
    const findings = await this.evaluatePolicyBatches(request, policies);
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
        denial: policy.denial,
      });
    }

    return {
      findings,
      violations,
      escalations,
    };
  }

  private async evaluatePolicyBatches(
    request: EvaluationRequest,
    policies: readonly Policy[],
  ): Promise<readonly PolicyFinding[]> {
    const batches: {
      readonly evaluator: PolicyEvaluator;
      readonly policies: Policy[];
    }[] = [];
    const batchByEvaluator = new Map<PolicyEvaluator, Policy[]>();

    for (const policy of policies) {
      const evaluator = this.resolveEvaluator(policy.evaluator);
      let batch = batchByEvaluator.get(evaluator);

      if (batch === undefined) {
        batch = [];
        batchByEvaluator.set(evaluator, batch);
        batches.push({
          evaluator,
          policies: batch,
        });
      }

      batch.push(policy);
    }

    const batchFindings: PolicyFinding[] = [];

    for (const batch of batches) {
      const findings = await this.evaluateBatch(request, batch.evaluator, batch.policies);

      batchFindings.push(...findings);
    }

    return orderFindingsByPolicy(batchFindings, policies);
  }

  private resolveEvaluator(evaluator: PolicyEvaluatorConfig | undefined): PolicyEvaluator {
    if (evaluator === undefined) {
      return this.evaluator;
    }

    const resolved = this.evaluatorOverrides.get(evaluator);

    if (resolved !== undefined) {
      return resolved;
    }

    const policyEvaluator = isScopraModel(evaluator)
      ? createModelEvaluator(evaluator, this.modelEvaluatorOptions)
      : evaluator;

    this.evaluatorOverrides.set(evaluator, policyEvaluator);

    return policyEvaluator;
  }

  private async evaluateBatch(
    request: EvaluationRequest,
    evaluator: PolicyEvaluator,
    policies: readonly Policy[],
  ): Promise<readonly PolicyFinding[]> {
    try {
      return await evaluator({
        request,
        policies,
      });
    } catch (error) {
      if (isScopraError(error)) {
        throw error;
      }

      throw new PolicyEvaluationError("Policy evaluator failed while evaluating policies.", {
        code: "policy_evaluator_failed",
        cause: error,
        context: createEvaluationErrorContext(request, policies, "policy_evaluator"),
      });
    }
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

function orderFindingsByPolicy(
  findings: readonly PolicyFinding[],
  policies: readonly Policy[],
): readonly PolicyFinding[] {
  const policyOrder = new Map(policies.map((policy, index) => [policy.id, index]));

  return [...findings].sort((left, right) => {
    const leftOrder = policyOrder.get(left.policyId);
    const rightOrder = policyOrder.get(right.policyId);

    if (leftOrder === undefined || rightOrder === undefined) {
      return 0;
    }

    return leftOrder - rightOrder;
  });
}
