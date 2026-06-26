import type { PolicyAction } from "./actions";

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
  /** Action applied when this policy receives a failed finding. */
  readonly action: PolicyAction;
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
  /** Action applied when this policy receives a failed finding. */
  readonly action: PolicyAction;

  /**
   * Creates a policy from its configuration.
   */
  constructor(options: PolicyOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.instruction = options.instruction;
    this.action = options.action;
  }
}
