import type { PolicyOptions } from "./policy";

/**
 * Blocks an evaluated request when the associated policy fails.
 */
export type DenyPolicyAction = {
  /** Identifies this action as blocking. */
  readonly type: "deny";
  /** Message returned on denied decisions for this policy. */
  readonly message: string;
  /** Optional minimum finding confidence required to deny. */
  readonly confidence?: number;
};

/**
 * Evaluates more detailed policies when the associated policy fails.
 */
export type EscalatePolicyAction = {
  /** Identifies this action as an escalation. */
  readonly type: "escalate";
  /** Detailed policies evaluated when this action escalates. */
  readonly policies: readonly PolicyOptions[];
  /** Optional minimum finding confidence required to escalate. */
  readonly confidence?: number;
};

/**
 * One confidence-gated branch in a conditional policy action.
 */
export type WhenPolicyActionCase = {
  /** Minimum finding confidence required to use this action. */
  readonly confidence: number;
  /** Action applied when this case matches. */
  readonly action: DenyPolicyAction | EscalatePolicyAction;
};

/**
 * Selects the first matching action for a failed finding by confidence.
 */
export type WhenPolicyAction = {
  /** Identifies this action as confidence-based routing. */
  readonly type: "when";
  /** Ordered action cases evaluated when the associated policy fails. */
  readonly cases: readonly WhenPolicyActionCase[];
};

/**
 * Action applied when a policy finding fails.
 */
export type PolicyAction = DenyPolicyAction | EscalatePolicyAction | WhenPolicyAction;

/**
 * Options for creating a deny action.
 */
export type DenyPolicyActionOptions = {
  /** Optional minimum finding confidence required to deny. */
  readonly confidence?: number;
};

/**
 * Options for creating an escalation action with one nested policy.
 */
export type EscalatePolicyActionSingleOptions = {
  /** Policy evaluated when this action escalates. */
  readonly policy: PolicyOptions;
  /** Multiple policies are mutually exclusive with policy. */
  readonly policies?: never;
  /** Optional minimum finding confidence required to escalate. */
  readonly confidence?: number;
};

/**
 * Options for creating an escalation action with multiple nested policies.
 */
export type EscalatePolicyActionMultipleOptions = {
  /** Single policy is mutually exclusive with policies. */
  readonly policy?: never;
  /** Policies evaluated when this action escalates. */
  readonly policies: readonly PolicyOptions[];
  /** Optional minimum finding confidence required to escalate. */
  readonly confidence?: number;
};

/**
 * Options for creating an escalation action.
 */
export type EscalatePolicyActionOptions =
  | EscalatePolicyActionSingleOptions
  | EscalatePolicyActionMultipleOptions;

/**
 * Creates a blocking policy action with the message returned to callers.
 *
 * Use this for policies that should deny a request when their finding fails.
 * When confidence is set, failed findings only deny at or above that confidence.
 */
export function deny(message: string, options: DenyPolicyActionOptions = {}): DenyPolicyAction {
  return {
    type: "deny",
    message,
    ...(options.confidence === undefined ? {} : { confidence: options.confidence }),
  };
}

/**
 * Creates an escalation policy action with nested policies for detailed review.
 *
 * Use this for broad policies that should run more specific policies when a
 * failed finding meets any configured confidence threshold.
 */
export function escalate(options: EscalatePolicyActionOptions): EscalatePolicyAction {
  const hasPolicy = "policy" in options && options.policy !== undefined;
  const hasPolicies = "policies" in options && options.policies !== undefined;

  if (hasPolicy === hasPolicies) {
    throw new Error("Escalate action requires exactly one of policy or policies.");
  }

  const policies = hasPolicy ? [options.policy] : options.policies;

  if (policies.length === 0) {
    throw new Error("Escalate action requires at least one policy.");
  }

  return {
    type: "escalate",
    policies,
    ...(options.confidence === undefined ? {} : { confidence: options.confidence }),
  };
}

/**
 * Creates a confidence-based action router.
 *
 * Cases are evaluated in declaration order. If no case matches, the failed
 * finding does not produce a violation or escalation.
 */
export function when(...cases: readonly WhenPolicyActionCase[]): WhenPolicyAction {
  if (cases.length === 0) {
    throw new Error("When action requires at least one case.");
  }

  return {
    type: "when",
    cases,
  };
}
