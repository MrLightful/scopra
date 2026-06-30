import type { PolicyEvaluator } from "./evaluation";
import type { ScopraModel } from "./model";

/**
 * Evaluator configuration accepted by policies and policy pipelines.
 */
export type PolicyEvaluatorConfig = ScopraModel | PolicyEvaluator;

/**
 * Options for configuring escalation to one nested policy.
 */
export type PolicyEscalationSingleOptions = {
  /** Policy evaluated when this policy escalates. */
  readonly policy: PolicyOptions;
  /** Multiple policies are mutually exclusive with policy. */
  readonly policies?: never;
  /** Parent finding confidence at or below this value triggers detailed review. */
  readonly maxConfidence: number;
};

/**
 * Options for configuring escalation to multiple nested policies.
 */
export type PolicyEscalationMultipleOptions = {
  /** Single policy is mutually exclusive with policies. */
  readonly policy?: never;
  /** Policies evaluated when this policy escalates. */
  readonly policies: readonly PolicyOptions[];
  /** Parent finding confidence at or below this value triggers detailed review. */
  readonly maxConfidence: number;
};

/**
 * Configuration for review-only nested policy evaluation.
 */
export type PolicyEscalationOptions =
  | PolicyEscalationSingleOptions
  | PolicyEscalationMultipleOptions;

/**
 * Normalized escalation configuration stored on a policy.
 */
export type PolicyEscalationConfig = {
  /** Detailed policies evaluated when this policy escalates. */
  readonly policies: readonly PolicyOptions[];
  /** Parent finding confidence at or below this value triggers detailed review. */
  readonly maxConfidence: number;
};

/**
 * Configuration used to define a policy.
 */
export type PolicyOptions = {
  /** Stable identifier used to match evaluator findings to this policy. */
  readonly id: string;
  /** Human-readable policy name. */
  readonly name: string;
  /** Optional summary of what the policy protects or enforces. */
  readonly description?: string;
  /** Instruction passed to an evaluator to describe the desired policy check. */
  readonly instruction: string;
  /** Message returned when this policy denies a request. */
  readonly message: string;
  /** Optional evaluator used instead of the pipeline evaluator for this policy. */
  readonly evaluator?: PolicyEvaluatorConfig;
  /** Optional minimum finding confidence required to deny. */
  readonly confidence?: number;
  /** Optional review-only nested policies evaluated for low-confidence findings. */
  readonly escalation?: PolicyEscalationOptions;
};

/**
 * Policy definition evaluated by a {@link PolicyPipeline}.
 */
export class Policy {
  /** Stable identifier used to match evaluator findings to this policy. */
  readonly id: string;
  /** Human-readable policy name. */
  readonly name: string;
  /** Optional summary of what the policy protects or enforces. */
  readonly description: string | undefined;
  /** Instruction passed to an evaluator to describe the desired policy check. */
  readonly instruction: string;
  /** Message returned when this policy denies a request. */
  readonly message: string;
  /** Optional evaluator used instead of the pipeline evaluator for this policy. */
  readonly evaluator: PolicyEvaluatorConfig | undefined;
  /** Optional minimum finding confidence required to deny. */
  readonly confidence: number | undefined;
  /** Optional review-only nested policies evaluated for low-confidence findings. */
  readonly escalation: PolicyEscalationConfig | undefined;

  /**
   * Creates a policy from its configuration.
   */
  constructor(options: PolicyOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.instruction = options.instruction;
    this.message = options.message;
    this.evaluator = options.evaluator;
    this.confidence = options.confidence;
    this.escalation =
      options.escalation === undefined ? undefined : normalizeEscalation(options.escalation);
  }
}

function normalizeEscalation(options: PolicyEscalationOptions): PolicyEscalationConfig {
  const hasPolicy = "policy" in options && options.policy !== undefined;
  const hasPolicies = "policies" in options && options.policies !== undefined;

  if (hasPolicy === hasPolicies) {
    throw new Error("Policy escalation requires exactly one of policy or policies.");
  }

  const policies = hasPolicy ? [options.policy] : options.policies;

  if (policies.length === 0) {
    throw new Error("Policy escalation requires at least one policy.");
  }

  if ("confidence" in options && options.confidence !== undefined) {
    throw new Error("Policy escalation uses maxConfidence instead of confidence.");
  }

  if (!("maxConfidence" in options) || options.maxConfidence === undefined) {
    throw new Error("Policy escalation requires maxConfidence.");
  }

  return {
    policies,
    maxConfidence: options.maxConfidence,
  };
}
